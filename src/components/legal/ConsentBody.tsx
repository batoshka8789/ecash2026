import {
  CONSENT_BLOCKS,
  CONSENT_INTRO,
  CONSENT_TITLE,
  type ConsentBlock,
} from '@/lib/legal/consent';

/**
 * Текст Согласия — общий для страницы `/legal/consent` и модалки на
 * регистрации. Один источник разметки: расхождению между «документом по
 * ссылке» и «документом в окне» взяться неоткуда, а юридически это должен
 * быть буквально один и тот же текст.
 *
 * Заголовок необязателен: в модалке он уже есть в шапке окна.
 */
export function ConsentBody({ withTitle = true }: { withTitle?: boolean }) {
  return (
    <>
      {withTitle && (
        <h1 className="text-xl font-bold leading-tight text-text-default sm:text-3xl">
          {CONSENT_TITLE}
        </h1>
      )}

      <p className="mt-6 text-sm leading-relaxed text-text-disabled sm:text-base">
        {CONSENT_INTRO}
      </p>

      {CONSENT_BLOCKS.map((block: ConsentBlock, i: number) => {
        if (block.kind === 'section') {
          return (
            <h2 key={i} className="mt-8 text-base font-bold text-text-default sm:text-lg">
              {block.title}
            </h2>
          );
        }
        if (block.kind === 'list') {
          return (
            <ul
              key={i}
              className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm leading-relaxed text-text-disabled sm:text-base"
            >
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return (
          <p key={i} className="mt-3 text-sm leading-relaxed text-text-disabled sm:text-base">
            {block.text}
          </p>
        );
      })}
    </>
  );
}
