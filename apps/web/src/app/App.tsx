import { ChunkTestButton } from '../components/TestButton';
export function App() {
  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="/" aria-label="Dashboard 3D — trang chủ">
          <span className="brand-mark" aria-hidden="true">
            D
          </span>{' '}
          Dashboard <strong>3D</strong>
        </a>
        <span className="stage">Collection</span>
      </header>
      <main>
        <ChunkTestButton />
        <p className="eyebrow">KHÁM PHÁ CHẤT LƯỢNG DỮ LIỆU</p>
        <h1>Bắt đầu từ dữ liệu của bạn.</h1>
        <p className="intro">
          Quan sát dữ liệu nguồn, xem trước từng thay đổi và tiếp tục phiên làm việc đã lưu.
        </p>
        <section className="empty-state" aria-labelledby="collection-title">
          <div className="file-mark" aria-hidden="true">
            CSV
          </div>
          <h2 id="collection-title">Chưa có dữ liệu</h2>
          <p>Nhập CSV và các thao tác xử lý sẽ được bổ sung ở giai đoạn tiếp theo.</p>
          <p className="limit">CSV · Tối đa 20 MB (20.000.000 byte)</p>
        </section>
        <p className="scope-note" role="status">
          Bản nền tảng — chưa hỗ trợ nhập tệp, lưu phiên hoặc đồng bộ.
        </p>
      </main>
      <footer>
        Collection <span aria-hidden="true">→</span> Pre-processing
      </footer>
    </div>
  );
}