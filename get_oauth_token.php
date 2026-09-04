<?php

/**
 * Optional Google OAuth2 helper for Gmail SMTP.
 * The password-reset flow uses the Gmail App Password in .env and does not
 * require this page.
 */

use League\OAuth2\Client\Provider\Google;

require __DIR__ . '/vendor/autoload.php';

session_start();

if (isset($_GET['code'])) {
    if (!isset($_GET['state'], $_SESSION['oauth2_state'])
        || !hash_equals($_SESSION['oauth2_state'], (string) $_GET['state'])) {
        http_response_code(400);
        exit('Invalid OAuth state.');
    }

    $provider = new Google([
        'clientId' => $_SESSION['oauth_client_id'],
        'clientSecret' => $_SESSION['oauth_client_secret'],
        'redirectUri' => $_SESSION['oauth_redirect_uri']
    ]);
    $token = $provider->getAccessToken('authorization_code', ['code' => $_GET['code']]);
    unset($_SESSION['oauth2_state'], $_SESSION['oauth_client_id'], $_SESSION['oauth_client_secret'], $_SESSION['oauth_redirect_uri']);
    echo 'Refresh Token: ' . htmlspecialchars((string) $token->getRefreshToken(), ENT_QUOTES, 'UTF-8');
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ?>
    <!doctype html>
    <html lang="en">
    <body>
      <h1>Google Gmail OAuth</h1>
      <p>Use this optional helper only when Gmail OAuth is required. App Password SMTP does not need it.</p>
      <form method="post">
        <label>Client ID <input type="text" name="client_id" required></label><br>
        <label>Client secret <input type="password" name="client_secret" required></label><br>
        <button type="submit">Continue with Google</button>
      </form>
    </body>
    </html>
    <?php
    exit;
}

$clientId = trim((string) ($_POST['client_id'] ?? ''));
$clientSecret = trim((string) ($_POST['client_secret'] ?? ''));
if ($clientId === '' || $clientSecret === '') {
    http_response_code(400);
    exit('Client ID and client secret are required.');
}

$redirectUri = (isset($_SERVER['HTTPS']) ? 'https://' : 'http://')
    . $_SERVER['HTTP_HOST'] . $_SERVER['PHP_SELF'];
$provider = new Google([
    'clientId' => $clientId,
    'clientSecret' => $clientSecret,
    'redirectUri' => $redirectUri
]);

$_SESSION['oauth2_state'] = $provider->getState();
$_SESSION['oauth_client_id'] = $clientId;
$_SESSION['oauth_client_secret'] = $clientSecret;
$_SESSION['oauth_redirect_uri'] = $redirectUri;

header('Location: ' . $provider->getAuthorizationUrl([
    'scope' => ['https://mail.google.com/'],
    'access_type' => 'offline',
    'prompt' => 'consent'
]));
exit;
