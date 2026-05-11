# Third-Party Software Notices — LAST SIGNAL

LAST SIGNAL is built with the following open-source and third-party software.
Their licences are reproduced or summarised below.

---

## Build Tools & Development Dependencies

### Vite 5.4.10
- **Licence:** MIT
- **Source:** https://github.com/vitejs/vite
- Used as the build tool and development server. Not included in the shipped
  game bundle; used only at build time.

> MIT License  
> Copyright (c) 2019-present, VoidZero Inc. & Vite contributors  
> Permission is hereby granted, free of charge, to any person obtaining a copy
> of this software and associated documentation files (the "Software"), to deal
> in the Software without restriction, including without limitation the rights
> to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
> copies of the Software, and to permit persons to whom the Software is
> furnished to do so, subject to the following conditions: The above copyright
> notice and this permission notice shall be included in all copies or
> substantial portions of the Software. THE SOFTWARE IS PROVIDED "AS IS",
> WITHOUT WARRANTY OF ANY KIND.

### TypeScript 5.5.4
- **Licence:** Apache-2.0
- **Source:** https://github.com/microsoft/TypeScript
- Used as the compile-time type checker and transpiler. Not included in the
  shipped game bundle; used only at build time.

> Copyright (c) Microsoft Corporation. Licensed under the Apache License,
> Version 2.0 (the "License"); you may not use this file except in compliance
> with the License. You may obtain a copy of the License at
> https://www.apache.org/licenses/LICENSE-2.0

---

## Runtime Third-Party Services

### CrazyGames SDK
- **Licence:** Proprietary — see https://docs.crazygames.com/sdk/
- **Source:** Runtime-loaded from https://sdk.crazygames.com; not bundled with
  the game files.
- Used for advertisement integration and optional cloud save functionality.
  The SDK is loaded only on the CrazyGames platform and only when the user has
  given consent to optional features.

---

## Audio Assets

No audio assets have been added to this release. The game uses WebAudio synthesis
for all music and SFX. Real audio assets are planned for v1.1 — this section will
be updated at that time with source URLs and licences.

---

## Fonts & Icons

No third-party fonts or icon libraries are used. All typography is rendered
using the browser's system font stack.

---

_If you believe a licence notice is missing or incorrect, please contact the
author at the email address listed in PRIVACY.md._
