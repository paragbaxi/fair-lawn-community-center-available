<details class="about">
  <summary>About this app</summary>
  <dl class="faq">
    <div class="faq-item">
      <dt>Is this official?</dt>
      <dd>No — this is a community project, not run by the town. Schedule data comes from <a href="https://www.fairlawn.org/park-rec" target="_blank" rel="noopener">fairlawn.org</a> and refreshes daily.</dd>
    </div>
    <div class="faq-item">
      <dt>How do I know if it's up to date?</dt>
      <dd>The "Updated" date below tells you when we last grabbed the schedule. If something seems off, check <a href="https://www.fairlawn.org/park-rec" target="_blank" rel="noopener">fairlawn.org/park-rec</a> directly.</dd>
    </div>
    <div class="faq-item">
      <dt>Can I put this on my phone?</dt>
      <dd>Yes. On iPhone: tap Share → "Add to Home Screen". On Android: tap the browser menu → "Install app". Works like a real app after that.</dd>
    </div>
  </dl>
</details>

<style>
  .about {
    margin-top: 16px;
    border-top: 1px solid var(--color-border);
  }

  .about summary {
    cursor: pointer;
    padding: 12px 0;
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    list-style: none;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
  }

  .about summary::before {
    content: '▶';
    font-size: 0.6rem;
    transition: transform 0.15s;
    display: inline-block;
  }

  .about[open] summary::before {
    transform: rotate(90deg);
  }

  .about .faq {
    padding-bottom: 16px;
  }

  .faq {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0;
    padding: 0;
  }

  .faq-item {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .faq dt {
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--color-text);
    letter-spacing: 0.01em;
  }

  .faq dd {
    font-size: 0.8rem;
    color: var(--color-text-secondary);
    margin: 0;
    line-height: 1.5;
  }

  .faq dd a {
    color: var(--color-text-secondary);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  @media (hover: hover) {
    .faq dd a:hover {
      color: var(--color-text);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .about summary::before {
      transition: none;
    }
  }
</style>
