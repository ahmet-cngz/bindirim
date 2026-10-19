# Frontend patterns from SchooLinks

Reference inspected: `/Users/ahmetcengiz/Desktop/schoolinks/sl-app/frontend`.
These examples describe the checked-out source, rather than assuming all legacy
components follow the newest conventions.

## Component structure

The reference groups a component's implementation, props, styles, and tests in
one directory:

```text
AudienceChips/
  AudienceChips.tsx
  AudienceChips.types.ts
  AudienceChips.module.css
```

See `src/modules/MessageCenterV2/components/AudienceChips/` in the reference.
The implementation imports props using `import type`, imports CSS Modules as
`s`, destructures typed props with defaults, and exports the component as default.
Tests, when needed, use the `.spec.tsx` suffix alongside the implementation.

An equivalent Bindirim example would be:

```text
components/common/PageHeader/
  PageHeader.tsx
  PageHeader.types.ts
  PageHeader.module.css
```

```ts
// PageHeader.types.ts
import type { ReactNode } from "react";

export interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}
```

```tsx
// PageHeader.tsx
import type { PageHeaderProps } from "./PageHeader.types";
import s from "./PageHeader.module.css";

const PageHeader = ({ title, description, action }: PageHeaderProps) => (
  <header className={s.header}>
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
    {action}
  </header>
);

export default PageHeader;
```

```css
/* PageHeader.module.css */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-24);
}
```

This is a structural example, not a replacement for the existing MUI header.
Keep Bindirim's typography, tokens, responsiveness, and behavior when migrating.

The reference imports components by folder path without an `index.ts` barrel.
That works because it has a custom Vite resolver, an ESLint resolver, and a
generated TypeScript path map. See `adr/015-folder-file-name-convention.md`,
`adr/017-typescript-folder-import-resolution.md`, and
`tools/vite/resolveMatchingFileName.ts`. Bindirim's current CRA setup does not
have that machinery: use an explicit `PageHeader/PageHeader` import if adopting
these folders without changing the build system.

## Type contracts

The reference separates types by ownership:

| Contract | Location | Reference example |
| --- | --- | --- |
| API request/response and backend entities | Beside API functions in `*.types.ts` | `src/core/api/otp.types.ts`, consumed by `otp.ts` |
| Shared feature state and UI models | Feature `types.ts` or `types/` directory | `src/modules/MessageCenterV2/types.ts` |
| Component props | Component `*.types.ts` for larger contracts | `AudienceChips.types.ts` |
| Generic shared hook contracts | `src/hooks/types.ts` | Shared hook return interfaces |

`otp.ts` explicitly types request arguments and response returns with contracts
from `otp.types.ts`. Components reuse API and feature types in their props
instead of repeating entity shapes. Use `import type` for type-only dependencies;
runtime values, such as constants, need ordinary imports.

The written standards also allow local interfaces for simple props; separate
props files are an established pattern, not a universal requirement. See
`docs/typescript/typescript-standards.md` in the reference.

For Bindirim, `src/types/models.ts` already owns backend entity shapes. Reuse
`Watch`, `Product`, and `PriceAlert` in component contracts. Introduce request and
response contracts next to an API module when extracting endpoint functions
from hooks. Preserve backend field names such as `target_price` in API contracts.
TypeScript contracts check code at compile time; they do not validate JSON at
runtime.

## PostCSS and CSS Modules

There is no project PostCSS config file or `postcss` configuration key in the
reference's `vite.config.mts`. No PostCSS config was found in its ancestor
directories through the user's home directory either. Do not infer a custom
nesting, mixin, or autoprefixer pipeline from its CSS Modules usage.

What the reference explicitly configures is **CSS Modules naming**, under
`css.modules.generateScopedName` in `vite.config.mts`:

- `mode === "prod"`: `[hash:base64:5]`.
- Other modes: a readable name derived from the source path and local class,
  with path separators replaced by underscores.

Its package declares `postcss` and `postcss-modules-local-by-default`.
The custom Stylelint rule in
`tools/stylelint-plugin-schoolinks/rules/no-global-scoped-selector.js` uses them
to enforce module scoping. That lint rule is distinct from build configuration.

Bindirim currently uses `react-scripts@5.0.1`. Its installed
`node_modules/react-scripts/config/webpack.config.js` sets
`postcssOptions.config: false`, so adding `postcss.config.js` alone would have no
effect. Its current non-Tailwind pipeline includes:

- `postcss-flexbugs-fixes`.
- `postcss-preset-env`, stage 3, with Autoprefixer `flexbox: "no-2009"`.
- `postcss-normalize`.

Browser targets come from `browserslist` in `package.json`. SCSS is compiled by
Sass before passing through the CSS/PostCSS loader chain. CRA already supports
`.module.css` and `.module.scss`; component style colocation can be adopted
without migrating the build system. Custom plugin configuration or the exact
reference class-naming scheme would require additional build configuration.
