<?php

use PHPMailer\PHPMailer\PHPMailer;

require __DIR__ . '/vendor/autoload.php';

function loadMailSettings(): array
{
  $settings = is_file(__DIR__ . '/.env') ? parse_ini_file(__DIR__ . '/.env') : [];
  foreach (['GMAIL_USER', 'GMAIL_APP_PASSWORD', 'MAIL_FROM'] as $key) {
    if (!empty(getenv($key))) {
      $settings[$key] = getenv($key);
    }
  }
  return $settings;
}

function sendContactEmail(array $input): void
{
  $settings = loadMailSettings();
  $sender = trim((string) ($settings['GMAIL_USER'] ?? ''));
  $password = trim((string) ($settings['GMAIL_APP_PASSWORD'] ?? ''));
  $from = trim((string) ($settings['MAIL_FROM'] ?? $sender));
  $recipient = trim((string) ($settings['MAIL_TO'] ?? $sender));
  $replyTo = filter_var($input['email'] ?? '', FILTER_VALIDATE_EMAIL);
  $name = trim((string) ($input['name'] ?? ''));
  $subject = trim((string) ($input['subject'] ?? 'ITResolve contact message'));
  $message = trim((string) ($input['message'] ?? ''));

  if (!$sender || !$password || !$from || !$recipient) {
    throw new RuntimeException('Gmail SMTP is not configured.');
  }
  if (!$name || !$replyTo || !$message) {
    throw new InvalidArgumentException('Name, email, and message are required.');
  }

  $mail = new PHPMailer(true);
  $mail->isSMTP();
  $mail->Host = 'smtp.gmail.com';
  $mail->SMTPAuth = true;
  $mail->Username = $sender;
  $mail->Password = $password;
  $mail->SMTPSecure = PHPMailer::ENCRYPTION_SMTPS;
  $mail->Port = 465;
  $mail->CharSet = 'UTF-8';
  $mail->setFrom($from, 'ITResolve Website');
  $mail->addAddress($recipient);
  $mail->addReplyTo($replyTo, $name);
  $mail->isHTML(true);
  $mail->Subject = $subject;
  $mail->Body = '<p><strong>From:</strong> ' . htmlspecialchars($name, ENT_QUOTES, 'UTF-8') . '</p>'
    . '<p><strong>Email:</strong> ' . htmlspecialchars($replyTo, ENT_QUOTES, 'UTF-8') . '</p>'
    . '<p>' . nl2br(htmlspecialchars($message, ENT_QUOTES, 'UTF-8')) . '</p>';
  $mail->AltBody = "From: {$name} <{$replyTo}>\n\n{$message}";
  $mail->send();
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['send'])) {
  try {
    sendContactEmail($_POST);
    header('Location: index.php?mail=sent');
    exit;
  } catch (Throwable $error) {
    http_response_code(400);
    echo htmlspecialchars($error->getMessage(), ENT_QUOTES, 'UTF-8');
  }
}