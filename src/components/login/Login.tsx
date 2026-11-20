import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { AuthService } from '@/application/services/domains';
import { buildLoginUrl } from '@/application/session/sign_in';
import { AuthProvider, LoginProviderId, LoginProviders } from '@/application/types';
import { ReactComponent as Logo } from '@/assets/icons/workzen-symbol.svg';
import { LOGIN_ACTION } from '@/components/login/const';
import EmailLogin from '@/components/login/EmailLogin';
import LoginProvider from '@/components/login/LoginProvider';
import { readCachedLoginProviders, writeCachedLoginProviders } from '@/components/login/loginProvidersCache';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { getPlatform } from '@/utils/platform';

/** Providers the email form already covers, so they do not imply an SSO block. */
const EMAIL_FIRST_PROVIDERS: LoginProviderId[] = [AuthProvider.EMAIL, AuthProvider.PASSWORD, AuthProvider.MAGIC_LINK];

/** One server response, so one piece of state — the halves cannot diverge. */
const NO_LOGIN_PROVIDERS: LoginProviders = {
  providers: [],
  customProviders: [],
  ldapProviders: [],
};

export function Login({ redirectTo }: { redirectTo: string }) {
  const { t } = useTranslation();
  const [loginProviders, setLoginProviders] = useState<LoginProviders>(
    () => readCachedLoginProviders() ?? NO_LOGIN_PROVIDERS
  );

  // Render the last server-confirmed configuration immediately, then
  // revalidate it so deployment changes still become authoritative.
  useEffect(() => {
    let active = true;

    const fetchProviders = async () => {
      try {
        const response = await AuthService.getAuthProviders();
        const providers = {
          providers: response.providers || [],
          customProviders: response.customProviders || [],
          ldapProviders: response.ldapProviders || [],
        };

        writeCachedLoginProviders(providers);
        if (active) setLoginProviders(providers);
      } catch (error) {
        console.error('Failed to fetch auth providers:', error);
        // Keep the cached first paint on transient errors. Provider login is
        // still accepted or rejected by the server when a button is used.
      }
    };

    void fetchProviders();

    return () => {
      active = false;
    };
  }, []);

  // Filter to check if there are any OAuth providers (not EMAIL or PASSWORD)
  const hasOAuthProviders = loginProviders.providers.some((provider) => !EMAIL_FIRST_PROVIDERS.includes(provider));

  const isMobile = getPlatform().isMobile;

  return (
    <div
      style={{
        justifyContent: isMobile ? 'flex-start' : 'between',
      }}
      className={'flex  h-full flex-col items-center justify-between gap-5 px-4 py-10 text-text-primary'}
    >
      <div className={'flex w-full flex-1 flex-col items-center justify-center gap-5'}>
        <div
          onClick={() => {
            window.location.href = '/';
          }}
          className={'flex w-full cursor-pointer flex-col items-center justify-center gap-5'}
        >
          <Logo className={'h-9 w-9'} />
          <div className={'text-xl font-semibold'}>{t('welcomeTo')} {t('appName')}</div>
        </div>
        <EmailLogin redirectTo={redirectTo} />
        {/* Keeps the form where it was before the upstream terms/privacy line was removed. */}
        <div aria-hidden className={'h-9 w-[300px]'} />
        {hasOAuthProviders && (
          <div className={'flex w-full items-center justify-center gap-2 text-text-secondary'}>
            <Separator className={'flex-1'} />
            {t('web.or')}
            <Separator className={'flex-1'} />
          </div>
        )}
        <LoginProvider
          redirectTo={redirectTo}
          availableProviders={loginProviders.providers}
          customProviders={loginProviders.customProviders}
          ldapProviders={loginProviders.ldapProviders}
        />
        <div className={'flex items-center gap-1 text-sm text-text-secondary'}>
          <span>{t('signIn.dontHaveAnAccount')}</span>
          <Button
            variant={'link'}
            onClick={() => {
              window.location.href = buildLoginUrl({
                action: LOGIN_ACTION.SIGN_UP_PASSWORD,
                redirectTo,
              });
            }}
            className={'px-0 text-text-secondary underline'}
            data-testid='login-create-account-button'
          >
            {t('signIn.createAccount')}
          </Button>
        </div>
      </div>

      {/* Same height as the removed upstream website footer, so the form stays vertically centred where it was. */}
      <div aria-hidden style={{ marginBottom: isMobile ? 64 : '0' }} className={'h-[41px] w-full'} />
    </div>
  );
}

export default Login;
