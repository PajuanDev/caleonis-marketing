// Browser fixture mounts the actual Caléonis host component; only its API hook is substituted.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {EmbeddedStudio} from '@/caleonis/host/embedded-studio.component';
createRoot(document.getElementById('host-root')!).render(<EmbeddedStudio projectId="11111111-1111-4111-8111-111111111111"/>);
