import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "이용약관",
  description: "momment. 서비스 이용약관",
};

export default function TermsPage() {
  return (
    <div className="flex-1 min-w-0">
      <div className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur-xl px-4 py-3">
        <h1 className="text-lg font-black text-foreground">이용약관</h1>
        <p className="text-[12px] font-medium text-muted-foreground">Terms of Service</p>
      </div>

      <article className="legal-prose max-w-none px-5 py-6">
        <p className="text-muted-foreground">최종 업데이트: 2026년 5월 19일</p>

        <h2>1. 서비스 개요</h2>
        <p>
          momment.(이하 &quot;서비스&quot;)는 사용자 간의 어텐션(관심) 기반 소셜 네트워킹 플랫폼으로,
          어텐션 클러스터 생성, 콘텐츠 공유, 예측 참여, MOM Energy 기반 기여 보상 시스템을 제공합니다.
          본 서비스는 momment. 팀(이하 &quot;운영자&quot;)이 운영합니다.
        </p>

        <h2>2. 이용자 자격</h2>
        <ul>
          <li>만 14세 이상인 자</li>
          <li>이메일 인증 또는 소셜 로그인을 통해 계정을 생성한 자</li>
          <li>본 약관에 동의한 자</li>
        </ul>

        <h2>3. 계정</h2>
        <p>
          사용자는 정확한 정보를 제공하여 계정을 생성해야 합니다.
          계정의 보안 유지는 사용자의 책임이며, 계정 정보의 무단 사용이 확인되면
          즉시 운영자에게 알려야 합니다.
        </p>

        <h2>4. 콘텐츠</h2>
        <h3>4.1 사용자 콘텐츠</h3>
        <p>
          사용자는 서비스에 게시하는 모든 콘텐츠(포스트, 댓글, 예측 등)에 대한 책임을 집니다.
          사용자가 게시한 콘텐츠의 지적재산권은 해당 사용자에게 귀속됩니다.
          단, 서비스 운영에 필요한 범위 내에서 운영자에게 비독점적 이용권을 부여합니다.
        </p>
        <h3>4.2 금지 콘텐츠</h3>
        <ul>
          <li>타인의 명예를 훼손하는 콘텐츠</li>
          <li>허위 정보 또는 의도적 오해를 유발하는 콘텐츠</li>
          <li>불법적 활동을 조장하는 콘텐츠</li>
          <li>타인의 개인정보를 침해하는 콘텐츠</li>
          <li>저작권 또는 기타 지적재산권을 침해하는 콘텐츠</li>
          <li>스팸, 악성코드, 봇을 이용한 자동화된 콘텐츠</li>
        </ul>

        <h2>5. MOM Energy 및 경제 시스템</h2>
        <p>
          MOM Energy는 서비스 내 기여도를 나타내는 포인트 시스템입니다.
          MOM Energy는 법정 화폐가 아니며, 현금으로 환전할 수 없습니다.
          운영자는 MOM Energy의 가치, 획득 방식, 사용처를 사전 고지 후 변경할 수 있습니다.
        </p>

        <h2>6. 광고 및 스폰서십</h2>
        <p>
          사용자는 MOM Energy를 사용하여 광고 캠페인 또는 어텐션 스폰서십을 집행할 수 있습니다.
          광고 콘텐츠는 관련 법령 및 본 약관의 콘텐츠 정책을 준수해야 합니다.
          운영자는 정책 위반 광고를 사전 통보 없이 비활성화할 수 있습니다.
        </p>

        <h2>7. AIO(Attention Intelligence Oracle)</h2>
        <p>
          AIO 시스템은 사용자의 어텐션에 대한 결과 예측 및 검증을 지원합니다.
          AIO의 판단은 참고용이며, 투자, 법률, 의료 등 전문적 조언을 대체하지 않습니다.
          AIO 결과에 기반한 사용자의 결정은 사용자 본인의 책임입니다.
        </p>

        <h2>8. 서비스 중단 및 변경</h2>
        <p>
          운영자는 서비스의 전부 또는 일부를 사전 고지 후 변경하거나 중단할 수 있습니다.
          긴급한 상황(보안 위협, 법적 요구 등)에서는 사전 고지 없이 조치할 수 있습니다.
        </p>

        <h2>9. 면책</h2>
        <p>
          서비스는 &quot;있는 그대로(AS IS)&quot; 제공됩니다.
          운영자는 서비스의 정확성, 안정성, 지속성에 대해 보증하지 않으며,
          서비스 이용으로 인한 간접적, 부수적, 결과적 손해에 대해 책임지지 않습니다.
        </p>

        <h2>10. 준거법 및 관할</h2>
        <p>
          본 약관은 대한민국 법률에 따라 해석되며,
          분쟁 발생 시 서울중앙지방법원을 관할 법원으로 합니다.
        </p>

        <hr />
        <p className="text-muted-foreground text-[12px]">
          © 2026 momment. All rights reserved.
        </p>
      </article>
    </div>
  );
}
