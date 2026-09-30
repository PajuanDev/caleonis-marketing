import React from 'react';
import { createRoot } from 'react-dom/client';
import { NextIntlClientProvider } from 'next-intl';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StudioShell } from '@/components/studio/StudioShell';
import messages from '@/messages/fr.json';
const root = document.getElementById('studio-root');
if (!root) throw new Error('Studio root missing');
createRoot(root).render(<NextIntlClientProvider locale="fr" messages={messages} timeZone="Europe/Paris"><TooltipProvider><StudioShell/></TooltipProvider></NextIntlClientProvider>);
