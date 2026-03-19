import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.48.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, password, role, sites, departments, status } = await req.json()

    if (!name || !email || !password || !role) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: 'Service role not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    const existingUser = await supabase
      .from('enprotec_users')
      .select('id')
      .eq('email', email)
      .maybeSingle()

    if (existingUser.error) {
      return new Response(JSON.stringify({ error: existingUser.error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (existingUser.data) {
      return new Response(JSON.stringify({ error: 'User with this email already exists' }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const authResponse = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        role,
        sites,
        departments,
        status: status ?? 'Active',
      },
    })

    if (authResponse.error || !authResponse.data?.user) {
      return new Response(
        JSON.stringify({ error: authResponse.error?.message ?? 'Failed to create auth user' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const authUser = authResponse.data.user

    const profileInsert = await supabase
      .from('enprotec_users')
      .insert({
        id: authUser.id,
        name,
        email,
        role,
        sites,
        departments,
        status: status ?? 'Active',
      })
      .select('*')
      .single()

    if (profileInsert.error) {
      await supabase.auth.admin.deleteUser(authUser.id)
      return new Response(JSON.stringify({ error: profileInsert.error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify(profileInsert.data), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('create-user function error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

