import { Outlet, createFileRoute } from '@tanstack/react-router';
import { Kbd } from '@worknest/ui';

export const Route = createFileRoute('/_auth')({
  component: AuthLayout,
});

function AuthLayout() {
  return (
    <div className="relative grid h-screen w-screen grid-cols-1 overflow-hidden bg-[color:var(--bg)] md:grid-cols-[1.2fr_1fr]">
      {/* Left poster — hidden on small screens */}
      <div className="relative hidden flex-col overflow-hidden border-r border-[color:var(--border-subtle)] bg-[color:var(--panel)] p-10 md:flex">
        {/* Grid ornament */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
            WebkitMaskImage:
              'radial-gradient(ellipse at 30% 30%, #000 10%, transparent 75%)',
            maskImage: 'radial-gradient(ellipse at 30% 30%, #000 10%, transparent 75%)',
          }}
        />

        {/* Brand */}
        <div className="relative z-10 flex items-center gap-[10px] text-[14px] font-semibold text-foreground">
          <div
            className="grid h-6 w-6 place-items-center rounded-[7px] bg-[color:var(--fg)] font-mono text-[color:var(--bg)]"
            style={{ fontWeight: 700 }}
          >
            W
          </div>
          <span>Worknest</span>
        </div>

        {/* Pitch */}
        <div className="relative z-10 mt-auto">
          <h1
            className="mb-[18px] max-w-[520px] text-[52px] font-normal leading-[1.03] tracking-[-0.02em] text-foreground"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            집중은
            <br />
            키보드에서{' '}
            <em className="italic text-[color:var(--accent)] not-italic" style={{ fontStyle: 'italic' }}>
              시작
            </em>
            된다.
          </h1>
          <p className="mb-7 max-w-[480px] text-[14px] leading-[1.55] text-[color:var(--fg-mid)]">
            이슈, 보드, 문서가 한 곳에서 흘러가는 작업 공간. 마우스를 떼지 않아도 되는 속도,
            깜빡임 없는 화면 전환, 팀이 지금 무엇을 만들고 있는지 한 눈에.
          </p>
          <div className="flex flex-wrap gap-4 font-mono text-[11.5px] text-[color:var(--fg-dim)]">
            <span className="inline-flex items-center gap-[6px]">
              <Kbd>⌘K</Kbd> 명령 팔레트
            </span>
            <span className="inline-flex items-center gap-[6px]">
              <Kbd>C</Kbd> 이슈 생성
            </span>
            <span className="inline-flex items-center gap-[6px]">
              <Kbd>G</Kbd>
              <Kbd>I</Kbd> 이동
            </span>
          </div>
        </div>
      </div>

      {/* Right form pane */}
      <div className="flex items-center justify-center overflow-auto p-10">
        <Outlet />
      </div>
    </div>
  );
}
