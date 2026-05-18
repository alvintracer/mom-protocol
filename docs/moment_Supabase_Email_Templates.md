# momment. Supabase Email Templates

Supabase Dashboard의 `Authentication > Email Templates`에 붙여넣는 사용자용 이메일 템플릿이다.

momment.의 기본 흐름은 다음과 같다.

- 첫 가입: 이메일 인증번호 입력 후 앱에서 비밀번호 설정
- 재로그인: 비밀번호 로그인 또는 이메일 인증번호 로그인 중 선택
- 비밀번호 재설정: Supabase Reset password 링크로 세션을 연 뒤 앱에서 새 비밀번호 설정

`Confirm sign up`과 `Magic link`는 본문에 `{{ .Token }}`을 사용한다. `{{ .ConfirmationURL }}`을 넣으면 링크 방식으로 발송된다.

중요 설정:

- 로그인 화면의 `signInWithOtp()` 호출은 Supabase의 `Magic link` 템플릿을 사용한다. 기존 유저 재로그인 메일이 클릭 인증으로 오면 `Magic link` 템플릿이 아직 `{{ .ConfirmationURL }}`을 포함하고 있는 상태다.
- 첫 가입 확인 메일은 `Confirm sign up` 템플릿을 사용한다. 신규 유저 메일이 클릭 인증으로 오면 `Confirm sign up` 템플릿을 확인한다.
- 템플릿에서 `{{ .ConfirmationURL }}`이 버튼, 링크, 숨은 텍스트, 주석, footer 등에 하나라도 남아 있으면 링크 방식으로 발송될 수 있으니 `Confirm sign up`과 `Magic link`에는 `{{ .Token }}`만 남긴다.
- Supabase 서버의 실제 만료 시간은 `Authentication > Providers > Email > Email OTP Expiration`에서 `300`초로 설정한다. 앱 화면의 5분 타이머는 UX 표시이고, 서버 만료 시간은 이 설정이 기준이다.
- Supabase 기본 재요청 간격은 60초다. momment. 화면도 같은 기준으로 `다시 보내기`를 1분마다 허용한다.

## Confirm Sign Up

Subject:

```txt
momment. 인증번호
```

Body:

```html
<div style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:24px;font-weight:900;letter-spacing:-0.02em;margin-bottom:28px;">momment.</div>
    <h1 style="font-size:26px;line-height:1.3;margin:0 0 12px;font-weight:900;color:#111111;">인증번호를 입력해주세요</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 24px;color:#555555;">momment. 가입을 계속하려면 아래 6자리 숫자를 입력하세요. 인증이 끝나면 비밀번호를 설정할 수 있습니다.</p>
    <div style="display:inline-block;background:#f5f8ff;border:1px solid #dbeafe;border-radius:16px;padding:18px 24px;font-size:32px;line-height:1;font-weight:900;letter-spacing:0.18em;color:#2563eb;">{{ .Token }}</div>
    <p style="font-size:13px;line-height:1.7;margin:24px 0 0;color:#777777;">이 인증번호는 짧은 시간 동안만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해도 됩니다.</p>
  </div>
</div>
```

## Magic Link

Subject:

```txt
momment. 로그인 인증번호
```

Body:

```html
<div style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:24px;font-weight:900;letter-spacing:-0.02em;margin-bottom:28px;">momment.</div>
    <h1 style="font-size:26px;line-height:1.3;margin:0 0 12px;font-weight:900;color:#111111;">로그인 인증번호</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 24px;color:#555555;">momment.에 로그인하려면 아래 6자리 숫자를 입력하세요.</p>
    <div style="display:inline-block;background:#f5f8ff;border:1px solid #dbeafe;border-radius:16px;padding:18px 24px;font-size:32px;line-height:1;font-weight:900;letter-spacing:0.18em;color:#2563eb;">{{ .Token }}</div>
    <p style="font-size:13px;line-height:1.7;margin:24px 0 0;color:#777777;">이 인증번호는 짧은 시간 동안만 유효합니다. 본인이 요청하지 않았다면 이 메일을 무시해도 됩니다.</p>
  </div>
</div>
```

## Invite User

Subject:

```txt
momment. 초대가 도착했습니다
```

Body:

```html
<div style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:24px;font-weight:900;letter-spacing:-0.02em;margin-bottom:28px;">momment.</div>
    <h1 style="font-size:26px;line-height:1.3;margin:0 0 12px;font-weight:900;color:#111111;">momment.에 참여하세요</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 28px;color:#555555;">초대를 수락하고 지금의 흐름을 함께 따라가세요.</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:14px 22px;border-radius:999px;">초대 수락하기</a>
    <p style="font-size:13px;line-height:1.7;margin:28px 0 0;color:#777777;">버튼이 열리지 않으면 아래 링크를 브라우저에 붙여넣어주세요.</p>
    <p style="font-size:12px;line-height:1.6;margin:8px 0 0;word-break:break-all;color:#2563eb;">{{ .ConfirmationURL }}</p>
  </div>
</div>
```

## Change Email Address

Subject:

```txt
momment. 이메일 변경 확인
```

Body:

```html
<div style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:24px;font-weight:900;letter-spacing:-0.02em;margin-bottom:28px;">momment.</div>
    <h1 style="font-size:26px;line-height:1.3;margin:0 0 12px;font-weight:900;color:#111111;">새 이메일을 확인해주세요</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 28px;color:#555555;">momment. 계정 이메일을 {{ .NewEmail }}로 변경하려면 아래 버튼을 눌러주세요.</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:14px 22px;border-radius:999px;">이메일 변경 확인</a>
    <p style="font-size:13px;line-height:1.7;margin:28px 0 0;color:#777777;">본인이 요청하지 않았다면 이 메일을 무시해도 됩니다.</p>
  </div>
</div>
```

## Reset Password

Subject:

```txt
momment. 비밀번호 재설정
```

Body:

```html
<div style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:24px;font-weight:900;letter-spacing:-0.02em;margin-bottom:28px;">momment.</div>
    <h1 style="font-size:26px;line-height:1.3;margin:0 0 12px;font-weight:900;color:#111111;">비밀번호를 다시 설정하세요</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 28px;color:#555555;">아래 버튼을 누르면 momment.에서 새 비밀번호를 설정할 수 있습니다.</p>
    <a href="{{ .ConfirmationURL }}" style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;font-size:15px;font-weight:800;padding:14px 22px;border-radius:999px;">비밀번호 재설정</a>
    <p style="font-size:13px;line-height:1.7;margin:28px 0 0;color:#777777;">버튼이 열리지 않으면 아래 링크를 브라우저에 붙여넣어주세요.</p>
    <p style="font-size:12px;line-height:1.6;margin:8px 0 0;word-break:break-all;color:#2563eb;">{{ .ConfirmationURL }}</p>
  </div>
</div>
```

## Reauthentication

Subject:

```txt
momment. 보안 확인
```

Body:

```html
<div style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:24px;font-weight:900;letter-spacing:-0.02em;margin-bottom:28px;">momment.</div>
    <h1 style="font-size:26px;line-height:1.3;margin:0 0 12px;font-weight:900;color:#111111;">보안 확인이 필요합니다</h1>
    <p style="font-size:15px;line-height:1.7;margin:0 0 24px;color:#555555;">민감한 작업을 계속하려면 아래 인증번호를 입력하세요.</p>
    <div style="display:inline-block;background:#f5f8ff;border:1px solid #dbeafe;border-radius:16px;padding:18px 24px;font-size:32px;line-height:1;font-weight:900;letter-spacing:0.18em;color:#2563eb;">{{ .Token }}</div>
    <p style="font-size:13px;line-height:1.7;margin:24px 0 0;color:#777777;">본인이 요청하지 않았다면 계정을 확인해주세요.</p>
  </div>
</div>
```

## Security Notifications

Security 섹션은 인증 동작용이 아니라 알림용이다. 기본적으로 아래처럼 짧게 유지한다.

### Password Changed

Subject:

```txt
momment. 비밀번호가 변경되었습니다
```

Body:

```html
<div style="margin:0;padding:0;background:#ffffff;color:#111111;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Noto Sans KR',Arial,sans-serif;">
  <div style="max-width:560px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:24px;font-weight:900;letter-spacing:-0.02em;margin-bottom:28px;">momment.</div>
    <h1 style="font-size:24px;line-height:1.3;margin:0 0 12px;font-weight:900;color:#111111;">비밀번호가 변경되었습니다</h1>
    <p style="font-size:15px;line-height:1.7;margin:0;color:#555555;">방금 momment. 계정의 비밀번호가 변경되었습니다. 본인이 변경하지 않았다면 즉시 계정을 확인해주세요.</p>
  </div>
</div>
```
