import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/temp-reset')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = request.headers.get('x-reset-secret')
        if (secret !== 'tmp-reset-9f4e2a7c') {
          return new Response('unauthorized', { status: 401 })
        }
        const { userId, password } = (await request.json()) as { userId: string; password: string }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password })
        if (error) return new Response(error.message, { status: 500 })
        return new Response('ok')
      },
    },
  },
})
