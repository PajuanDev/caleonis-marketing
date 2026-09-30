import React from 'react';
import {createRoot} from 'react-dom/client';
import {CreativeStudio} from '../../../apps/frontend/src/caleonis/studio/creative-studio';
import {SWRConfig} from 'swr';
createRoot(document.getElementById('root')!).render(<SWRConfig value={{dedupingInterval:0,shouldRetryOnError:false,provider:()=>new Map()}}><CreativeStudio documentId="22222222-2222-4222-8222-222222222222"/></SWRConfig>);
