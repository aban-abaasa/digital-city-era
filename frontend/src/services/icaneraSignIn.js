import { supabase, createIsolatedAuthClient } from './supabase'

// Sign in with ICANera credentials: the email + password of the ICANera
// account (shared Supabase project, shared auth.users, so the same account
// works across ICAN, digital-city-era and mybodaguy). This replaces the old
// wallet account number + PIN sign-in, whose 4-6 digit PIN could be guessed.
//
// The password is checked on an isolated client. If the account has
// two-step verification (authenticator app) switched on in ICAN, the session
// is only handed to the app-wide client once the 6-digit code has been
// accepted, so a stolen password alone never gets anyone in.
//
// Resolves to { status: 'signed_in' } or
// { status: 'mfa_required', verify(code), cancel() }.
export const signInWithIcanera = async (email, password) => {
  const isolated = createIsolatedAuthClient()

  const { error } = await isolated.auth.signInWithPassword({
    email: String(email || '').trim().toLowerCase(),
    password,
  })
  if (error) throw error

  const adoptSession = async () => {
    const { data: { session } } = await isolated.auth.getSession()
    if (!session) throw new Error('Sign-in failed. Please try again.')

    const { error: adoptError } = await supabase.auth.setSession({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    })
    if (adoptError) throw adoptError
    // Not signOut(): that would revoke the very session just handed over.
    isolated.auth.stopAutoRefresh()
  }

  // Fail closed: if the assurance level can't be read, don't sign in.
  const { data: aal, error: aalError } = await isolated.auth.mfa.getAuthenticatorAssuranceLevel()
  if (aalError || !aal) {
    await isolated.auth.signOut()
    throw new Error('Could not check your two-step verification. Please try again.')
  }

  if (aal.currentLevel === 'aal1' && aal.nextLevel === 'aal2') {
    return {
      status: 'mfa_required',
      verify: async (code) => {
        const { data: factors, error: factorsError } = await isolated.auth.mfa.listFactors()
        if (factorsError) throw factorsError
        const factor = factors?.totp?.find((f) => f.status === 'verified')
        if (!factor) throw new Error('Could not find your authenticator app. Sign in to ICAN to review two-step verification.')

        const { error: verifyError } = await isolated.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
        if (verifyError) throw verifyError
        await adoptSession()
      },
      cancel: async () => {
        await isolated.auth.signOut().catch(() => undefined)
      },
    }
  }

  await adoptSession()
  return { status: 'signed_in' }
}
