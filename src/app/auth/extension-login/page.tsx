'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import AuthForm from '@/components/AuthForm';

export default function ExtensionLoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage(
        'Account created successfully! Please login to get started.'
      );
    }
    if (searchParams.get('verified') === 'true') {
      setSuccessMessage(
        'Email verified successfully! Please login to continue.'
      );
    }
  }, [searchParams]);

  const handleLogin = async (data: { email: string; password: string }) => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/extension-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Login failed');
      }

      // For extension login, we'll send the token to the extension via postMessage
      // The extension's content script will listen for this message
      if (window.opener && window.opener !== window) {
        // Send token to extension via window.opener (popup scenario)
        window.opener.postMessage(
          {
            type: 'EXTENSION_LOGIN_SUCCESS',
            accessToken: result.accessToken,
            refreshToken: result.refreshToken,
            user: result.user,
          },
          '*'
        );

        // Show success message and close window after a brief delay
        setSuccessMessage('Login successful! You can close this tab.');
        setTimeout(() => {
          window.close();
        }, 2000);
      } else {
        // Fallback: try to communicate with extension via chrome.runtime
        // This works when the extension opens a new tab
        try {
          // Try to communicate directly with the extension
          if (
            typeof chrome !== 'undefined' &&
            chrome.runtime &&
            chrome.runtime.sendMessage
          ) {
            chrome.runtime.sendMessage(
              {
                type: 'SAVE_AUTH_TOKENS',
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                user: result.user,
              },
              (response) => {
                if (response && response.success) {
                  setSuccessMessage(
                    'Login successful! You can close this tab.'
                  );
                  setTimeout(() => {
                    window.close();
                  }, 2000);
                } else {
                  console.error(
                    'Failed to save tokens to extension:',
                    response
                  );
                  setSuccessMessage(
                    'Login successful! You can close this tab.'
                  );
                }
              }
            );
          } else {
            // Create a custom event that the extension's content script can listen to
            const event = new CustomEvent('extensionLoginSuccess', {
              detail: {
                accessToken: result.accessToken,
                refreshToken: result.refreshToken,
                user: result.user,
              },
            });
            window.dispatchEvent(event);

            setSuccessMessage('Login successful! You can close this tab.');

            // Also store in localStorage as a fallback
            localStorage.setItem('extensionAuthToken', result.accessToken);
            localStorage.setItem('extensionRefreshToken', result.refreshToken);
            localStorage.setItem('extensionUser', JSON.stringify(result.user));
          }
        } catch (extensionError) {
          console.error('Extension communication failed:', extensionError);
          // Fallback to regular login behavior
          localStorage.setItem('accessToken', result.accessToken);
          localStorage.setItem('refreshToken', result.refreshToken);
          localStorage.setItem('user', JSON.stringify(result.user));
          router.push('/dashboard');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Login to Prompt Manager Extension
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Please login to connect your Chrome extension
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <AuthForm
            mode="login"
            onSubmit={handleLogin}
            loading={loading}
            error={error}
            success={successMessage}
          />

          {successMessage && (
            <div className="mt-4 text-center text-sm text-green-600">
              Authentication successful! This tab will close automatically.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
