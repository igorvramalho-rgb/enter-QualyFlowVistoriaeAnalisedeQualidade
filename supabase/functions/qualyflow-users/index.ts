import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Action = "create" | "delete" | "set-status" | "reset-password";

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function usernameToEmail(username: string) {
  return `${username}@qualyflow.local`;
}

function sanitizeUsername(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}

function translateAuthError(message: string) {
  const text = message.toLowerCase();
  if (text.includes("already") || text.includes("duplicate")) {
    return "Este usuário já existe.";
  }
  if (text.includes("password")) {
    return "A senha precisa ter pelo menos 6 caracteres.";
  }
  return message;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("qualyflow-users: variáveis de ambiente ausentes");
      return json({ error: "Configuração do servidor incompleta." }, 500);
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader) {
      return json({ error: "Não autenticado." }, 401);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: callerData, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !callerData.user) {
      console.error("qualyflow-users: token inválido", callerError?.message);
      return json({ error: "Sessão inválida. Entre novamente." }, 401);
    }

    const admin = createClient(supabaseUrl, serviceKey);
    const { data: callerProfile, error: profileError } = await admin
      .from("qualyflow_profiles")
      .select("role,status")
      .eq("user_id", callerData.user.id)
      .maybeSingle();

    if (profileError) {
      console.error("qualyflow-users: erro ao ler perfil", profileError.message);
      return json({ error: "Não foi possível validar seu acesso." }, 500);
    }

    if (!callerProfile || callerProfile.role !== "gestor" || callerProfile.status !== "ativo") {
      console.warn("qualyflow-users: acesso negado para", callerData.user.id);
      return json({ error: "Apenas o gestor pode gerenciar usuários." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action ?? "") as Action;

    if (action === "create") {
      const username = sanitizeUsername(body.username);
      const password = String(body.password ?? "");
      const displayName = String(body.displayName ?? "").trim().slice(0, 80);
      const status = body.status === "pendente" ? "pendente" : "ativo";

      if (username.length < 3) {
        return json({ error: "O usuário precisa ter pelo menos 3 caracteres (letras, números, ponto ou hífen)." }, 400);
      }
      if (password.length < 6) {
        return json({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: usernameToEmail(username),
        password,
        email_confirm: true,
        user_metadata: { username, display_name: displayName },
      });

      if (createError || !created.user) {
        console.error("qualyflow-users: falha ao criar usuário", createError?.message);
        return json({ error: translateAuthError(createError?.message ?? "Falha ao criar usuário.") }, 400);
      }

      const { error: insertError } = await admin.from("qualyflow_profiles").insert({
        user_id: created.user.id,
        username,
        display_name: displayName,
        role: "vistoriador",
        status,
      });

      if (insertError) {
        console.error("qualyflow-users: falha ao criar perfil", insertError.message);
        await admin.auth.admin.deleteUser(created.user.id);
        return json({ error: "Não foi possível criar o perfil do usuário." }, 400);
      }

      return json({ ok: true, userId: created.user.id, username, status });
    }

    if (action === "delete") {
      const userId = String(body.userId ?? "");
      if (!userId) {
        return json({ error: "Usuário não informado." }, 400);
      }
      if (userId === callerData.user.id) {
        return json({ error: "Você não pode remover o próprio acesso." }, 400);
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
      if (deleteError) {
        console.error("qualyflow-users: falha ao remover", deleteError.message);
        return json({ error: deleteError.message }, 400);
      }

      await admin.from("qualyflow_profiles").delete().eq("user_id", userId);
      return json({ ok: true });
    }

    if (action === "set-status") {
      const userId = String(body.userId ?? "");
      const status = String(body.status ?? "");
      if (!userId || !["ativo", "pendente", "bloqueado"].includes(status)) {
        return json({ error: "Dados inválidos." }, 400);
      }
      if (userId === callerData.user.id && status !== "ativo") {
        return json({ error: "Você não pode bloquear o próprio acesso." }, 400);
      }

      const { error: updateError } = await admin
        .from("qualyflow_profiles")
        .update({ status })
        .eq("user_id", userId);

      if (updateError) {
        console.error("qualyflow-users: falha ao atualizar status", updateError.message);
        return json({ error: updateError.message }, 400);
      }
      return json({ ok: true, status });
    }

    if (action === "reset-password") {
      const userId = String(body.userId ?? "");
      const password = String(body.password ?? "");
      if (!userId || password.length < 6) {
        return json({ error: "Informe uma senha com pelo menos 6 caracteres." }, 400);
      }

      const { error: resetError } = await admin.auth.admin.updateUserById(userId, { password });
      if (resetError) {
        console.error("qualyflow-users: falha ao redefinir senha", resetError.message);
        return json({ error: resetError.message }, 400);
      }
      return json({ ok: true });
    }

    return json({ error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("qualyflow-users: erro inesperado", error);
    return json({ error: "Erro inesperado ao gerenciar usuários." }, 500);
  }
});
