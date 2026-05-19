import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "쿠키 정책",
  description: "momment. 쿠키 정책",
};

export default function CookiesPage() {
  return (
    <div className="flex-1 min-w-0">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <h1 className="text-lg font-black text-foreground">쿠키 정책</h1>
        <p className="text-[12px] font-medium text-muted-foreground">Cookie Policy</p>
      </div>

      <article className="legal-prose max-w-none px-5 py-6">
        <p className="text-muted-foreground">최종 업데이트: 2026년 5월 19일</p>

        <h2>1. 쿠키란?</h2>
        <p>
          쿠키는 웹사이트가 이용자의 브라우저에 저장하는 작은 텍스트 파일입니다.
          momment.는 쿠키 및 유사 기술을 사용하여 서비스를 제공하고 개선합니다.
        </p>

        <h2>2. 사용하는 쿠키 유형</h2>
        <table>
          <thead>
            <tr><th>유형</th><th>목적</th><th>보유 기간</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>필수 쿠키</strong></td>
              <td>로그인 세션 유지, 인증 토큰 관리, 보안</td>
              <td>세션 종료 시 또는 최대 30일</td>
            </tr>
            <tr>
              <td><strong>기능 쿠키</strong></td>
              <td>언어 설정, 테마 설정(라이트/다크 모드) 기억</td>
              <td>최대 1년</td>
            </tr>
            <tr>
              <td><strong>분석 쿠키</strong></td>
              <td>페이지 조회수, 체류 시간 등 서비스 이용 통계 수집</td>
              <td>최대 2년</td>
            </tr>
            <tr>
              <td><strong>광고 쿠키</strong></td>
              <td>Google AdSense를 통한 맞춤형 광고 표시</td>
              <td>Google 정책에 따름</td>
            </tr>
          </tbody>
        </table>

        <h2>3. 필수 쿠키</h2>
        <p>
          필수 쿠키는 서비스의 기본 기능을 위해 반드시 필요합니다.
          이 쿠키를 비활성화하면 로그인, 인증 등 핵심 기능이 작동하지 않을 수 있습니다.
        </p>
        <table>
          <thead>
            <tr><th>쿠키명</th><th>제공자</th><th>목적</th></tr>
          </thead>
          <tbody>
            <tr><td>sb-*-auth-token</td><td>Supabase</td><td>인증 세션 관리</td></tr>
            <tr><td>theme</td><td>momment.</td><td>다크/라이트 모드 설정</td></tr>
            <tr><td>lang</td><td>momment.</td><td>언어 설정</td></tr>
          </tbody>
        </table>

        <h2>4. 광고 쿠키 (Google AdSense)</h2>
        <p>
          momment.는 Google AdSense를 사용하여 광고를 표시할 수 있습니다.
          Google은 쿠키를 사용하여 이용자의 관심사에 기반한 광고를 제공합니다.
        </p>
        <ul>
          <li>
            Google의 광고 쿠키 사용에 대한 자세한 정보:{" "}
            <a href="https://policies.google.com/technologies/ads" target="_blank" rel="noreferrer">
              Google 광고 정책
            </a>
          </li>
          <li>
            맞춤 광고 비활성화:{" "}
            <a href="https://adssettings.google.com" target="_blank" rel="noreferrer">
              Google 광고 설정
            </a>
          </li>
        </ul>

        <h2>5. 쿠키 관리 방법</h2>
        <p>
          이용자는 브라우저 설정을 통해 쿠키를 관리할 수 있습니다:
        </p>
        <ul>
          <li><strong>Chrome:</strong> 설정 → 개인정보 및 보안 → 쿠키 및 기타 사이트 데이터</li>
          <li><strong>Firefox:</strong> 설정 → 개인 정보 및 보안 → 쿠키 및 사이트 데이터</li>
          <li><strong>Safari:</strong> 환경설정 → 개인 정보 보호 → 쿠키 및 웹사이트 데이터 관리</li>
          <li><strong>Edge:</strong> 설정 → 쿠키 및 사이트 권한 → 쿠키 및 사이트 데이터 관리</li>
        </ul>
        <p>
          쿠키를 비활성화하면 서비스의 일부 기능이 제한될 수 있습니다.
        </p>

        <h2>6. 변경 사항</h2>
        <p>
          본 쿠키 정책은 관련 법령 변경 또는 서비스 변경에 따라 수정될 수 있습니다.
          변경 시 서비스 내 공지를 통해 안내합니다.
        </p>

        <h2>7. 문의</h2>
        <p>
          쿠키 관련 문의사항은 아래로 연락해 주세요:
        </p>
        <ul>
          <li>이메일: privacy@momment.mom</li>
        </ul>

        <hr />
        <p className="text-muted-foreground text-[12px]">
          © 2026 momment. All rights reserved.
        </p>
      </article>
    </div>
  );
}
