/** Report successful Cafe UI actions to the optional browser demo guide. */
export function reportDemoTourResult(action: string, record?: string, activationKey?: string) {
  document.dispatchEvent(new CustomEvent('tl:demo-tour-result', { detail: { action, record, activationKey } }));
}
