// Attach the returned handler to a tab bar's onKeyDown (the container that
// wraps the tab <button>s). Left/Right arrow keys move focus between tab
// buttons and activate the newly focused one. Enter/Space already work
// natively since tabs are real <button> elements.
export default function useTabListKeyNav() {
  return (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const buttons = Array.from(e.currentTarget.querySelectorAll('button'));
    const currentIndex = buttons.indexOf(document.activeElement);
    if (currentIndex === -1) return;
    e.preventDefault();
    const nextIndex = e.key === 'ArrowRight'
      ? (currentIndex + 1) % buttons.length
      : (currentIndex - 1 + buttons.length) % buttons.length;
    buttons[nextIndex].focus();
    buttons[nextIndex].click();
  };
}
