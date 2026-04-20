import { Outlet, createFileRoute } from '@tanstack/react-router';
import { MotionBG } from '../components/auth/motion-bg';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="flex min-h-screen bg-[color:var(--bg-0)]">
      {/* Left poster — brand lockup top, MotionBG behind, quote at bottom */}
      <div
        className="sticky top-0 hidden h-screen flex-[1] flex-col overflow-hidden border-r border-[color:var(--border-subtle)] p-10 md:flex"
        style={{
          background: 'linear-gradient(180deg, var(--bg-0) 0%, var(--bg-1) 100%)',
        }}
      >
        <MotionBG />

        {/* Brand lockup — logo left, wordmark right, pinned to top-left */}
        <div className="relative z-[2] flex items-center gap-3 pointer-events-none">
          <img
            src="/worknest-logo-crop.png"
            alt=""
            aria-hidden="true"
            className="h-[56px] w-auto object-contain"
            draggable={false}
          />
          <span className="text-[28px] font-semibold tracking-[-0.02em] text-[color:var(--fg-1)]">
            WorkNest
          </span>
        </div>

        {/* Editorial quote block */}
        <div className="relative z-[2] mt-auto max-w-[480px] pointer-events-none">
          <div className="mb-[18px] text-[11px] font-medium tracking-[0.14em] text-[color:var(--fg-3)]">
            PRIVATE WORKSPACE
          </div>
          <h2 className="mb-4 text-[38px] font-semibold leading-[1.2] tracking-[-0.025em] text-[color:var(--fg-1)] [text-wrap:balance]">
            집중은
            <br />
            흩어진 것들을 <span className="text-[color:var(--accent-line)]">모으는 일</span>입니다.
          </h2>
          <p className="text-[15px] leading-[1.6] text-[color:var(--fg-3)] [text-wrap:pretty]">
            WorkNest는 이슈, 사이클, 위키를 하나의 조용한 작업 공간으로 묶어줍니다.
          </p>
        </div>
      </div>

      {/* Right form pane */}
      <div className="flex flex-[2] items-center justify-center overflow-auto px-14 py-16">
        <Outlet />
      </div>
    </div>
  );
}
