"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AlertCircle,
  Check,
  Database,
  Download,
  Loader2,
  Trash2,
  X,
} from "lucide-react";

import { apiFetch } from "@/lib/client-api";

type BackupFile = {
  filename: string;
  size: number;
  createdAt: string;
};

type BackupStats = {
  totalBackups: number;
  lastBackupTime: string | null;
  totalSize: number;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

type ConfirmAction = {
  type: "restore" | "delete";
  filename: string;
};

export function BackupsView() {
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [stats, setStats] = useState<BackupStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [msg, setMsg] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const loadBackups = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch("/backups");
      if (response.ok) {
        const data = await response.json();
        const list: BackupFile[] = data.backups || data.data || [];
        setBackups(list);

        // Compute stats from list
        const totalSize = list.reduce((sum, b) => sum + (b.size || 0), 0);
        const sorted = [...list].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        setStats({
          totalBackups: list.length,
          lastBackupTime: sorted.length > 0 ? sorted[0].createdAt : null,
          totalSize,
        });
      }
    } catch {
      setMsg("Không thể tải danh sách backup.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBackups();
  }, [loadBackups]);

  async function handleCreate() {
    setCreating(true);
    setMsg("");
    try {
      const response = await apiFetch("/backups", { method: "POST" });
      const data = await response.json();
      if (response.ok) {
        setMsg("Tạo bản sao lưu thành công.");
        loadBackups();
      } else {
        setMsg(data.message || "Lỗi tạo bản sao lưu.");
      }
    } catch {
      setMsg("Lỗi kết nối server.");
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore(filename: string) {
    setActionLoading(filename);
    setMsg("");
    try {
      const response = await apiFetch(`/backups/${encodeURIComponent(filename)}/restore`, {
        method: "POST",
      });
      const data = await response.json();
      if (response.ok) {
        setMsg(`Khôi phục từ "${filename}" thành công.`);
      } else {
        setMsg(data.message || "Lỗi khôi phục.");
      }
    } catch {
      setMsg("Lỗi kết nối server.");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }

  async function handleDelete(filename: string) {
    setActionLoading(filename);
    setMsg("");
    try {
      const response = await apiFetch(`/backups/${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setMsg(`Đã xóa bản sao lưu "${filename}".`);
        loadBackups();
      } else {
        const data = await response.json().catch(() => ({}));
        setMsg(data.message || "Lỗi xóa.");
      }
    } catch {
      setMsg("Lỗi kết nối server.");
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  }

  function onConfirm() {
    if (!confirmAction) return;
    if (confirmAction.type === "restore") {
      handleRestore(confirmAction.filename);
    } else {
      handleDelete(confirmAction.filename);
    }
  }

  return (
    <section className="content-single">
      <div className="panel">
        <div className="panel-heading">
          <div>
            <p>Hệ thống</p>
            <h2>Sao lưu & Khôi phục dữ liệu</h2>
          </div>
          <Database size={22} />
        </div>

        {/* Stats */}
        {stats && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 16,
              flexWrap: "wrap",
            }}
          >
            <div className="panel" style={{ flex: "1 1 160px", padding: "12px 16px" }}>
              <p className="muted-cell">Tổng số backup</p>
              <strong style={{ fontSize: 20 }}>{stats.totalBackups}</strong>
            </div>
            <div className="panel" style={{ flex: "1 1 160px", padding: "12px 16px" }}>
              <p className="muted-cell">Kích thước</p>
              <strong style={{ fontSize: 20 }}>{formatFileSize(stats.totalSize)}</strong>
            </div>
            <div className="panel" style={{ flex: "1 1 200px", padding: "12px 16px" }}>
              <p className="muted-cell">Lần cuối</p>
              <strong style={{ fontSize: 20 }}>
                {stats.lastBackupTime
                  ? new Date(stats.lastBackupTime).toLocaleString("vi-VN")
                  : "---"}
              </strong>
            </div>
          </div>
        )}

        {/* Create button */}
        <div style={{ marginBottom: 16 }}>
          <button
            className="full-button"
            disabled={creating}
            onClick={handleCreate}
            type="button"
            style={{ maxWidth: 260 }}
          >
            {creating ? (
              <Loader2 className="spin" size={16} />
            ) : (
              <Download size={16} />
            )}
            {creating ? "Đang tạo..." : "Tạo bản sao lưu"}
          </button>
        </div>

        {msg && <p className="muted-cell" style={{ marginBottom: 12 }}>{msg}</p>}

        {/* Table */}
        {loading ? (
          <p className="muted-cell" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Loader2 className="spin" size={16} /> Đang tải...
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tên file</th>
                  <th>Kích thước</th>
                  <th>Ngày tạo</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((backup) => {
                  const isWorking = actionLoading === backup.filename;

                  return (
                    <tr key={backup.filename}>
                      <td>
                        <strong>{backup.filename}</strong>
                      </td>
                      <td>{formatFileSize(backup.size)}</td>
                      <td>
                        {new Date(backup.createdAt).toLocaleString("vi-VN", {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </td>
                      <td>
                        <div className="inline-actions">
                          <button
                            className="small-button"
                            disabled={isWorking}
                            onClick={() =>
                              setConfirmAction({ type: "restore", filename: backup.filename })
                            }
                            title="Khôi phục"
                            type="button"
                          >
                            {isWorking ? (
                              <Loader2 className="spin" size={13} />
                            ) : (
                              <Download size={13} />
                            )}
                            Khôi phục
                          </button>
                          <button
                            className="small-button danger"
                            disabled={isWorking}
                            onClick={() =>
                              setConfirmAction({ type: "delete", filename: backup.filename })
                            }
                            title="Xóa"
                            type="button"
                          >
                            {isWorking ? (
                              <Loader2 className="spin" size={13} />
                            ) : (
                              <Trash2 size={13} />
                            )}
                            Xóa
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {backups.length === 0 && (
                  <tr>
                    <td className="muted-cell" colSpan={4}>
                      Chưa có bản sao lưu nào.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {confirmAction && (
        <div
          className="modal-overlay"
          onClick={() => !actionLoading && setConfirmAction(null)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <AlertCircle
                className={confirmAction.type === "delete" ? "text-danger" : ""}
                size={24}
              />
              <h3>
                {confirmAction.type === "restore"
                  ? "Xác nhận khôi phục"
                  : "Xác nhận xóa"}
              </h3>
            </div>
            <p className="modal-body">
              {confirmAction.type === "restore" ? (
                <>
                  Bạn có chắc chắn muốn khôi phục dữ liệu từ{" "}
                  <strong>&quot;{confirmAction.filename}&quot;</strong>?
                  <br />
                  Dữ liệu hiện tại sẽ bị đè.
                </>
              ) : (
                <>
                  Bạn có chắc chắn muốn xóa bản sao lưu{" "}
                  <strong>&quot;{confirmAction.filename}&quot;</strong>?
                  <br />
                  Hành động này không thể hoàn tác.
                </>
              )}
            </p>
            <div className="modal-footer">
              <button
                className="secondary-button"
                disabled={!!actionLoading}
                onClick={() => setConfirmAction(null)}
                type="button"
              >
                Hủy
              </button>
              <button
                className={
                  confirmAction.type === "delete"
                    ? "danger-button"
                    : "full-button"
                }
                disabled={!!actionLoading}
                onClick={onConfirm}
                type="button"
              >
                {actionLoading ? (
                  <Loader2 className="spin" size={16} />
                ) : confirmAction.type === "delete" ? (
                  <Trash2 size={16} />
                ) : (
                  <Check size={16} />
                )}
                {actionLoading
                  ? "Đang xử lý..."
                  : confirmAction.type === "restore"
                    ? "Khôi phục"
                    : "Xóa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
