import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "개인정보처리방침",
  description: "momment. 개인정보처리방침",
};

export default function PrivacyPage() {
  return (
    <div className="flex-1 min-w-0">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <h1 className="text-lg font-black text-foreground">개인정보처리방침</h1>
        <p className="text-[12px] font-medium text-muted-foreground">Privacy Policy</p>
      </div>

      <article className="legal-prose max-w-none px-5 py-6">
        <p className="text-muted-foreground">최종 업데이트: 2026년 5월 19일</p>

        <h2>1. 개요</h2>
        <p>
          momment.(이하 &quot;서비스&quot;)는 이용자의 개인정보를 소중히 보호하며,
          「개인정보 보호법」 등 관련 법령을 준수합니다.
          본 방침은 수집하는 개인정보의 항목, 수집 목적, 보유 기간, 이용자의 권리 등을 안내합니다.
        </p>

        <h2>2. 수집하는 개인정보</h2>
        <h3>2.1 필수 수집 항목</h3>
        <table>
          <thead>
            <tr><th>항목</th><th>목적</th></tr>
          </thead>
          <tbody>
            <tr><td>이메일 주소</td><td>계정 생성 및 인증, 중요 공지 발송</td></tr>
            <tr><td>프로필 정보 (닉네임, 핸들)</td><td>서비스 내 식별 및 커뮤니티 활동</td></tr>
            <tr><td>서비스 이용 기록</td><td>서비스 개선, 부정 이용 방지</td></tr>
          </tbody>
        </table>

        <h3>2.2 선택 수집 항목</h3>
        <table>
          <thead>
            <tr><th>항목</th><th>목적</th></tr>
          </thead>
          <tbody>
            <tr><td>프로필 사진, 배너 이미지</td><td>프로필 꾸미기</td></tr>
            <tr><td>소셜 링크 (X, Instagram 등)</td><td>외부 프로필 연결</td></tr>
            <tr><td>자기소개</td><td>커뮤니티 활동</td></tr>
          </tbody>
        </table>

        <h3>2.3 자동 수집 항목</h3>
        <ul>
          <li>IP 주소, 브라우저 종류, 운영체제</li>
          <li>방문 일시, 페이지 조회 기록</li>
          <li>쿠키 및 유사 기술을 통한 정보</li>
        </ul>

        <h2>3. 개인정보 이용 목적</h2>
        <ul>
          <li><strong>서비스 제공:</strong> 계정 관리, 콘텐츠 표시, MOM Energy 시스템 운영</li>
          <li><strong>서비스 개선:</strong> 이용 통계 분석, 기능 개선, 버그 수정</li>
          <li><strong>안전:</strong> 부정 이용 탐지 및 방지, 법적 의무 이행</li>
          <li><strong>커뮤니케이션:</strong> 서비스 관련 공지 및 안내</li>
          <li><strong>광고:</strong> 맞춤형 광고 표시 (Google AdSense 포함)</li>
        </ul>

        <h2>4. 개인정보 보유 및 파기</h2>
        <ul>
          <li>계정 정보: 회원 탈퇴 시 즉시 파기 (법령에 따라 보존이 필요한 경우 해당 기간 동안 보관)</li>
          <li>서비스 이용 기록: 3년 (전자상거래 등에서의 소비자보호에 관한 법률)</li>
          <li>로그인 기록: 3개월 (통신비밀보호법)</li>
        </ul>

        <h2>5. 개인정보의 제3자 제공</h2>
        <p>
          momment.는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다.
          다만, 다음의 경우는 예외입니다:
        </p>
        <ul>
          <li>이용자의 사전 동의가 있는 경우</li>
          <li>법령에 의해 요구되는 경우</li>
          <li>서비스 운영에 필수적인 외부 서비스 연동 (인증, 결제 등)</li>
        </ul>

        <h2>6. 외부 서비스</h2>
        <table>
          <thead>
            <tr><th>서비스</th><th>목적</th><th>개인정보처리방침</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Supabase</td>
              <td>인증 및 데이터 저장</td>
              <td><a href="https://supabase.com/privacy" target="_blank" rel="noreferrer">링크</a></td>
            </tr>
            <tr>
              <td>Google AdSense</td>
              <td>광고 표시</td>
              <td><a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">링크</a></td>
            </tr>
            <tr>
              <td>Vercel</td>
              <td>호스팅</td>
              <td><a href="https://vercel.com/legal/privacy-policy" target="_blank" rel="noreferrer">링크</a></td>
            </tr>
          </tbody>
        </table>

        <h2>7. 이용자의 권리</h2>
        <p>이용자는 언제든지 다음의 권리를 행사할 수 있습니다:</p>
        <ul>
          <li>개인정보 열람 요청</li>
          <li>개인정보 정정 요청</li>
          <li>개인정보 삭제 요청 (계정 탈퇴)</li>
          <li>개인정보 처리 정지 요청</li>
        </ul>
        <p>권리 행사는 서비스 내 설정 페이지 또는 이메일(privacy@momment.mom)을 통해 가능합니다.</p>

        <h2>8. 아동의 개인정보</h2>
        <p>
          momment.는 만 14세 미만 아동의 개인정보를 수집하지 않습니다.
          만 14세 미만의 이용이 확인된 경우, 해당 계정과 관련 데이터는 즉시 삭제합니다.
        </p>

        <h2>9. 개인정보 보호 책임자</h2>
        <ul>
          <li>책임자: momment. 운영팀</li>
          <li>이메일: privacy@momment.mom</li>
        </ul>

        <h2>10. 방침 변경</h2>
        <p>
          본 방침이 변경되는 경우, 변경 사항을 서비스 내 공지 및 이메일로 안내합니다.
          중요한 변경의 경우 최소 7일 전에 사전 고지합니다.
        </p>

        <hr />
        <p className="text-muted-foreground text-[12px]">
          © 2026 momment. All rights reserved.
        </p>
      </article>
    </div>
  );
}
