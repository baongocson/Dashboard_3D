
import { useState } from 'react';

import { runChunkDemo } from '../storage/services/chunk_demo';

export function ChunkTestButton() {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleTest() {
    if (loading) return;

    setLoading(true);
    setMessage('Đang lưu và kiểm tra dataset...');

    try {
      const result = await runChunkDemo();

      setMessage(
        [
          'Kiểm thử thành công!',
          `Số chunk: ${result.chunkCount}`,
          `Dung lượng: ${result.totalBytes} bytes`,
          `Khôi phục chính xác: ${result.isIdentical}`,
          `Manifest ID: ${result.manifestId}`,
        ].join('\n'),
      );
    } catch (error) {
      console.error('Chunk demo error:', error);

      setMessage(
        error instanceof Error
          ? `Kiểm thử thất bại: ${error.message}`
          : 'Đã xảy ra lỗi không xác định',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        padding: 16,
        border: '1px solid #888',
        borderRadius: 8,
        margin: 16,
      }}
    >
      <h3>IndexedDB Chunk Test</h3>

      <button
        type="button"
        onClick={handleTest}
        disabled={loading}
      >
        {loading ? 'Đang kiểm tra...' : 'Test Dataset Chunk'}
      </button>

      <pre style={{ whiteSpace: 'pre-wrap' }}>
        {message}
      </pre>
    </div>
  );
}
