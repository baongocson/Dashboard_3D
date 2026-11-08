import { useState } from 'react';
import type { Dataset } from '@dashboard/contracts';
import { CollectionPage } from '../features/collection/CollectionPage';
import { PreprocessingPage } from '../features/preprocessing/PreprocessingPage';
import { SessionControls } from '../features/session/SessionControls';
import { demoDataset, demoCollectionStatistics } from '../features/demo/demoDataset';
import { demoPreview } from '../features/demo/demoPreview';
import type { CellSelection } from '../components/DatasetTable';

const demoEnabled = import.meta.env.DEV && new URLSearchParams(window.location.search).get('demo') === '1';

export function App() {
  const [dataset, setDataset] = useState<Dataset | null>(() => demoEnabled ? demoDataset : null);
  const [section, setSection] = useState<'collection' | 'preprocessing'>('collection');
  const [selection, setSelection] = useState<CellSelection | null>(null);

  // These bindings are intentionally absent until their real adapters are merged:
  // CSV Worker (Nguyên), scene (Nga), durable local storage (Trâm), backend (Phúc/Tuấn).
  // Never replace an unavailable adapter with a "success" callback in production.
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Dashboard 3D — trang chủ">
          <span className="brand-mark" aria-hidden="true">D</span>
          Dashboard <strong>3D</strong>
        </a>
        <span className="stage">{section === 'collection' ? 'Collection' : 'Pre-processing'}</span>
        <SessionControls />
      </header>
      {section === 'collection' || !dataset ? (
        <CollectionPage
          dataset={dataset}
          fileName={demoEnabled ? 'du-lieu-mau-khong-phai-csv.csv' : undefined}
          statistics={demoEnabled ? demoCollectionStatistics : null}
          onNext={() => { if (dataset) setSection('preprocessing'); }}
          demoMode={demoEnabled}
        />
      ) : (
        <PreprocessingPage
          key={dataset.versionId}
          dataset={dataset}
          selection={selection}
          onSelectionChange={setSelection}
          onBack={() => { setSection('collection'); }}
          onPreview={demoEnabled ? demoPreview : undefined}
          onApplied={(nextDataset) => { setDataset(nextDataset); setSelection(null); }}
          demoMode={demoEnabled}
        />
      )}
      <footer>Collection <span aria-hidden="true">→</span> Pre-processing · Đây là bản UI; tính năng chưa kết nối được hiển thị rõ.</footer>
    </div>
  );
}
