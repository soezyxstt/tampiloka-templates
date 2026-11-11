import React from 'react';
import { createRoot } from 'react-dom/client';
import { LanguageProvider, LanguageToggle } from '../../lib/language';
import { AttendancePage } from '../../components/attendance/attendance-page';
import '../../app/globals.css';
let root = createRoot(document.getElementById('root')!);
const render = () => root.render(<LanguageProvider><AttendancePage tenantSlug="cafe" outletSlug={new URLSearchParams(location.search).get("fixtureOutlet") || "central"} /><LanguageToggle /></LanguageProvider>);
Object.assign(window, { unmountAttendanceFixture: () => root.unmount(), remountAttendanceFixture: () => { root = createRoot(document.getElementById('root')!); render(); } });
render();
