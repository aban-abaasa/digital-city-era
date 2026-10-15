import React from 'react';
import { STABLE_COIN_CSS } from './stableCoinTheme';

/** Renders the shared stable-coin theme. Safe to include in every component that uses `sc-*` classes: it is only CSS. */
export default function StableCoinStyles() {
  return <style data-stable-coin-theme="">{STABLE_COIN_CSS}</style>;
}
