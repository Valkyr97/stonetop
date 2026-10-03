import { writable } from 'svelte/store'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile } from './database.types'

export const session = writable<Session | null>(null)
export const user = writable<User | null>(null)
export const profile = writable<Profile | null>(null)
export const authReady = writable(false)

export async function initAuth() {
  const { data } = await supabase.auth.getSession()
  session.set(data.session)
  user.set(data.session?.user ?? null)
  if (data.session?.user) {
    await loadProfile(data.session.user.id)
  }
  authReady.set(true)

  supabase.auth.onAuthStateChange(async (_event, next) => {
    session.set(next)
    user.set(next?.user ?? null)
    if (next?.user) await loadProfile(next.user.id)
    else profile.set(null)
  })
}

async function loadProfile(userId: string) {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
  if (error) {
    console.error(error)
    return
  }
  profile.set(data)
}

export async function signIn(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function signUp(email: string, password: string, displayName: string) {
  // Login/registro es solo para el rol de GM; los jugadores usan el dispositivo sin cuenta.
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        display_name: displayName,
        role: 'gm',
      },
    },
  })
  if (error) throw error
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function updateDisplayName(displayName: string) {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('No autenticado')
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName })
    .eq('id', auth.user.id)
  if (error) throw error
  await loadProfile(auth.user.id)
}
