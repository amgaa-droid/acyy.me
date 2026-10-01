/**
 * Home and the popups opened from it. Detail screens navigated to from the planet system are
 * intercepted into `modal` (see `@modal/(..)*`) and slide up over the planets; the same URLs
 * opened directly, or from a full page, render as normal pages in `(shell)`.
 */
export default function HomeLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}
