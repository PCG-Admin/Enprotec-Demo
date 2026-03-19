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
    const { userId } = await req.json()

    if (!userId) {
      return new Response(JSON.stringify({ error: 'User ID is required' }), {
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

    // Check if user exists in database
    const existingUser = await supabase
      .from('enprotec_users')
      .select('id, email, name')
      .eq('id', userId)
      .maybeSingle()

    if (existingUser.error) {
      return new Response(JSON.stringify({ error: existingUser.error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (!existingUser.data) {
      return new Response(JSON.stringify({ error: 'User not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete from enprotec_users table first
    const deleteProfile = await supabase
      .from('enprotec_users')
      .delete()
      .eq('id', userId)

    if (deleteProfile.error) {
      return new Response(JSON.stringify({ error: deleteProfile.error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Delete from auth.users
    const authDelete = await supabase.auth.admin.deleteUser(userId)

    if (authDelete.error) {
      console.error('Failed to delete auth user:', authDelete.error)
      // Even if auth deletion fails, profile is deleted - return success
      // Auth user might already be deleted or not exist
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${existingUser.data.name} (${existingUser.data.email}) deleted successfully`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('delete-user function error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
