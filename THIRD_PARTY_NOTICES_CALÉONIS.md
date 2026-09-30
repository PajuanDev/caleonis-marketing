# Notices des composants du Studio Caléonis

Le fork principal reste soumis à sa licence AGPL-3.0 et aux notices amont.

## Open-Higgsfield — TechBe

Le contrat de capacités dans `libraries/helpers/src/caleonis/upstream/model-capabilities.ts` est adapté de `TechBeme/open-higgsfield`, fichier `src/models/capabilities/types.ts`, blob `0d5a14bb35c2008fc2738dab6f32e223271bcd01`. Cette première reprise ne constitue pas l'import de toute son interface, de tous ses fournisseurs ou de ses modèles. Caléonis a réduit le contrat aux contrôles effectivement exposés ; l'authentification et la persistance relèvent de Caléonis.

Le composant `apps/frontend/src/caleonis/studio/pill-popover.tsx` est adapté de `src/components/command-bar/PillPopover.tsx`, blob `d5fb4de683ffbb88bc1aff0528dff295be3dabc9`. Animation retirée, gestion du clavier et styles Caléonis ajoutés. Source : https://github.com/TechBeme/open-higgsfield

MIT License

Copyright (c) 2026 TechBe

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
