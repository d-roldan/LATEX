import { useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useEffect } from 'react';
import type { OrderAttachment } from '../api/ordersApi';
import { deleteAttachment, fetchAttachmentFile, updateAttachment, uploadAttachment } from '../api/ordersApi';
import { Paperclip, Trash2, Download, Upload, FileText, Image, X, Edit2, Save } from 'lucide-react';
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog';

interface Props {
  orderId: string;
  attachments: OrderAttachment[];
  canUpload: boolean;
  hideDownload?: boolean;
  title?: string;
  description?: string;
  isInternal?: boolean;
  onRefresh: () => void;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image size={16} />;
  return <FileText size={16} />;
}

export function AttachmentList({
  orderId,
  attachments,
  canUpload,
  hideDownload,
  title = 'Adjuntos',
  description,
  isInternal = false,
  onRefresh
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [preview, setPreview] = useState<OrderAttachment | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrderAttachment | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [imgZoom, setImgZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState({ isDragging: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const closePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPreview(null);
    setImgZoom(1);
  };

  const openPreview = async (attachment: OrderAttachment) => {
    setError(null);
    setPreviewLoading(true);
    try {
      const blob = await fetchAttachmentFile(orderId, attachment.id);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPreview(attachment);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo abrir el adjunto');
    } finally {
      setPreviewLoading(false);
    }
  };

  const downloadFile = async (attachment: OrderAttachment) => {
    setError(null);
    try {
      const blob = await fetchAttachmentFile(orderId, attachment.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = attachment.fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'No se pudo descargar el adjunto');
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      await uploadAttachment(orderId, file, isInternal);
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al subir archivo');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (att: OrderAttachment) => {
    setDeletingId(att.id);
    try {
      await deleteAttachment(orderId, att.id);
      setDeleteTarget(null);
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al eliminar adjunto');
    } finally {
      setDeletingId(null);
    }
  };

  const startEdit = (att: OrderAttachment) => {
    setEditingId(att.id);
    setEditingName(att.fileName);
  };

  const handleRename = async (att: OrderAttachment) => {
    const nextName = editingName.trim();
    if (!nextName) return;
    setError(null);
    setDeletingId(att.id);
    try {
      await updateAttachment(orderId, att.id, nextName);
      setEditingId(null);
      setEditingName('');
      onRefresh();
    } catch (err: any) {
      setError(err.response?.data?.message ?? 'Error al editar adjunto');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="attachment-list">
      <div className="attachment-header" style={{ alignItems: 'center' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
          <Paperclip size={15} />
          {title} ({attachments.length})
        </span>
        {canUpload && (
          <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer', fontWeight: 700 }}>
            {uploading
              ? <span className="spinner-xs" />
              : <><Upload size={13} /> Subir archivo</>
            }
            <input
              type="file"
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
              style={{ display: 'none' }}
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
        )}
      </div>
      {description && (
        <p style={{ margin: '-0.25rem 0 0.75rem', color: 'var(--ink-muted)', fontSize: '0.78rem' }}>
          {description}
        </p>
      )}

      {error && (
        <div className="alert alert-error" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
          {error}
        </div>
      )}

      {attachments.length === 0 ? (
        <p style={{ color: 'var(--ink-muted)', fontSize: '0.85rem', margin: '0.5rem 0' }}>
          Sin adjuntos
        </p>
      ) : (
        <ul className="attachment-items">
          {attachments.map((att) => (
            <li key={att.id} className="attachment-item" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: '0.4rem', background: 'var(--panel)', marginBottom: '0.5rem' }}>
              <button
                type="button"
                className="attachment-icon unstyled-button"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', background: 'var(--neutral-bg)', borderRadius: '4px' }}
                onClick={() => void openPreview(att)}
                disabled={previewLoading}
                title="Abrir adjunto"
              >
                {getFileIcon(att.mimeType)}
              </button>
              {editingId === att.id ? (
                <input
                  className="input"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  style={{ flex: 1, minWidth: '160px', height: '34px' }}
                />
              ) : (
                <span className="attachment-name" title={att.fileName} style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500, fontSize: '0.85rem' }}>
                  {att.fileName}
                </span>
              )}
              {att.sizeBytes && (
                <span className="attachment-size">{formatBytes(att.sizeBytes)}</span>
              )}
              <div className="attachment-actions" style={{ display: 'flex', gap: '0.4rem' }}>
                {(att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf') && (
                  <button
                    className="btn-icon"
                    title="Ver en grande"
                    onClick={() => void openPreview(att)}
                    disabled={previewLoading}
                  >
                    {att.mimeType.startsWith('image/') ? <Image size={13} /> : <FileText size={13} />}
                  </button>
                )}
                {!hideDownload && (
                  <button
                    type="button"
                    className="btn-icon"
                    onClick={() => void downloadFile(att)}
                    title="Descargar"
                  >
                    <Download size={13} />
                  </button>
                )}
                {canUpload && (
                  <>
                    {editingId === att.id ? (
                      <button
                        className="btn-icon"
                        title="Guardar nombre"
                        disabled={deletingId === att.id || !editingName.trim()}
                        onClick={() => handleRename(att)}
                      >
                        {deletingId === att.id ? <span className="spinner-xs" /> : <Save size={13} />}
                      </button>
                    ) : (
                      <button
                        className="btn-icon"
                        title="Editar nombre"
                        onClick={() => startEdit(att)}
                      >
                        <Edit2 size={13} />
                      </button>
                    )}
                    <button
                      className="btn-icon btn-icon--danger"
                      title="Eliminar"
                      disabled={deletingId === att.id}
                      onClick={() => setDeleteTarget(att)}
                    >
                      {deletingId === att.id ? <span className="spinner-xs" /> : <Trash2 size={13} />}
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Image preview modal */}
      {preview && createPortal(
        <div
          className="modal-overlay"
          onClick={closePreview}
          style={{ zIndex: 9999 }}
        >
          <div
            className="modal-panel attachment-preview-modal"
            style={{ maxWidth: '90vw', maxHeight: '90vh', width: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="attachment-preview-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', padding: '0 0.5rem' }}>
              <strong style={{ fontSize: '1.1rem' }}>{preview.fileName}</strong>
              <div className="attachment-preview-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                {preview.mimeType.startsWith('image/') && (
                   <div style={{ display: 'flex', gap: '0.25rem', marginRight: '0.5rem' }}>
                     <button className="btn btn-secondary btn-sm" onClick={() => setImgZoom(z => Math.max(0.25, z - 0.25))} title="Alejar">-</button>
                     <button className="btn btn-secondary btn-sm" onClick={() => setImgZoom(1)} title="Restablecer">{Math.round(imgZoom * 100)}%</button>
                     <button className="btn btn-secondary btn-sm" onClick={() => setImgZoom(z => Math.min(5, z + 0.25))} title="Acercar">+</button>
                   </div>
                )}
                {!hideDownload && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void downloadFile(preview)}
                    title="Descargar"
                  >
                    <Download size={13} /> Descargar
                  </button>
                )}
                <button className="btn-icon" onClick={closePreview} style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
                  <X size={16} />
                </button>
              </div>
            </div>
            <div 
              ref={containerRef}
              style={{ 
                flex: 1, overflow: 'auto', background: 'var(--neutral-bg)', borderRadius: '0.25rem', position: 'relative',
                cursor: dragState.isDragging ? 'grabbing' : 'grab'
              }}
              onMouseDown={(e) => {
                if (!containerRef.current) return;
                e.preventDefault();
                setDragState({
                  isDragging: true,
                  startX: e.clientX,
                  startY: e.clientY,
                  scrollLeft: containerRef.current.scrollLeft,
                  scrollTop: containerRef.current.scrollTop
                });
              }}
              onMouseMove={(e) => {
                if (!dragState.isDragging || !containerRef.current) return;
                const dx = e.clientX - dragState.startX;
                const dy = e.clientY - dragState.startY;
                containerRef.current.scrollLeft = dragState.scrollLeft - dx;
                containerRef.current.scrollTop = dragState.scrollTop - dy;
              }}
              onMouseUp={() => setDragState(s => ({ ...s, isDragging: false }))}
              onMouseLeave={() => setDragState(s => ({ ...s, isDragging: false }))}
            >
              {preview.mimeType.startsWith('image/') ? (
                <div style={{ 
                  padding: '1rem', 
                  width: `${imgZoom * 100}%`, 
                  minWidth: '100%', 
                  minHeight: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  transition: dragState.isDragging ? 'none' : 'width 0.2s'
                }}>
                  <img
                    src={previewUrl ?? undefined}
                    alt={preview.fileName}
                    draggable={false}
                    style={{ 
                      maxWidth: '100%',
                      maxHeight: imgZoom === 1 ? '75vh' : 'none',
                      height: 'auto',
                      objectFit: 'contain',
                      borderRadius: '0.25rem',
                      pointerEvents: 'none',
                      display: 'block'
                    }}
                  />
                </div>
              ) : preview.mimeType === 'application/pdf' && previewUrl ? (
              <iframe
                src={previewUrl}
                style={{ width: '100%', height: '70vh', border: 'none', borderRadius: '0.25rem' }}
                title={preview.fileName}
              />
            ) : (
              <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--neutral-bg)', borderRadius: '0.5rem', height: '100%' }}>
                <FileText size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                <p>Vista previa no disponible para este tipo de archivo.</p>
              </div>
            )}
            </div>
          </div>
        </div>,
        document.body
      )}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Eliminar adjunto"
        description={`Se quitará "${deleteTarget?.fileName ?? 'el archivo'}" de la orden de producción.`}
        confirmLabel="Eliminar"
        cancelLabel="Conservar"
        variant="destructive"
        isPending={!!deletingId}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
      />
    </div>
  );
}
