import { ConstellationArt } from "@/components/app/constellation";

type SignHeroProps = {
  label: string;
  signCode: string;
  signName: string;
  chips: string[];
};

/** Big tinted card with the sign's constellation — "Таны орд: Хилэнц". */
export function SignHero({ label, signCode, signName, chips }: SignHeroProps) {
  return (
    <section className="relative h-60 overflow-hidden rounded-3xl bg-tint-1 lg:h-90 lg:rounded-3xl">
      <ConstellationArt
        sign={signCode}
        className="absolute -top-2 -right-10 size-60 lg:top-[-20px] lg:right-4 lg:size-100"
      />
      <div className="absolute bottom-5 left-5 flex flex-col gap-1.5 lg:bottom-8 lg:left-9 lg:gap-2.5">
        <span className="text-xs font-semibold tracking-widest text-highlight uppercase">
          {label}
        </span>
        <span className="font-heading text-5xl leading-[0.95] font-semibold lg:text-7xl">
          {signName}
        </span>
        <div className="mt-1 flex flex-wrap gap-2">
          {chips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-surface/70 px-3 py-1.5 text-xs font-medium lg:text-sm"
            >
              {chip}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
