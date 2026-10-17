import { useState } from "react";

import { COPIED, SHARE } from "../copy/screen";

interface Props {
  readonly url: string;
  readonly text: string;
}

/** Opens the system share sheet where there is one, otherwise copies the link. */
export function ShareButton({ url, text }: Props) {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    if (typeof navigator.share === "function") {
      // Closing the share sheet rejects; there is nothing to do then.
      await navigator.share({ url, text }).catch(() => undefined);
      return;
    }
    await navigator.clipboard.writeText(url);
    setCopied(true);
  };
  return (
    <button type="button" className="toggle share" onClick={() => void share()}>
      {copied ? COPIED : SHARE}
    </button>
  );
}
