"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SHOP_PROVIDER_TYPES, isPlatformOwnerEmail } from "@/lib/brand";
import { CategorySelect } from "@/components/ui/CategoryIcon";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { adminRoleLabel, canAssignSuperAdmin, canDeleteUsers, isManager, normalizeAdminRole } from "@/lib/admin-access";

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  username: string | null;
  role: string;
  admin_role: string | null;
  account_status: string;
};

type ShopOption = {
  id: string;
  name: string;
  login_shop_id: string | null;
  owner_user_id: string | null;
  provider_type?: string | null;
};

export function ManageUsersClient({
  users,
  shops,
  currentUserId,
  currentAdminRole,
  currentUserEmail,
}: {
  users: UserRow[];
  shops: ShopOption[];
  currentUserId: string;
  currentAdminRole?: string | null;
  currentUserEmail?: string | null;
}) {
  const viewer = { admin_role: normalizeAdminRole(currentAdminRole), email: currentUserEmail };
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [pendingRevert, setPendingRevert] = useState<UserRow | null>(null);
  const [pendingDelete, setPendingDelete] = useState<UserRow | null>(null);
  const viewerCanDelete = canDeleteUsers(viewer);

  const shopsByOwner = useMemo(() => {
    const map = new Map<string, ShopOption>();
    for (const shop of shops) {
      if (shop.owner_user_id) map.set(shop.owner_user_id, shop);
    }
    return map;
  }, [shops]);

  const managerOnly = isManager(viewer);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((user) =>
      [user.name, managerOnly ? null : user.email, user.username, user.role].some((value) =>
        String(value || "").toLowerCase().includes(q),
      ),
    );
  }, [users, query, managerOnly]);

  async function call(action: string, payload: Record<string, unknown>, key: string) {
    setError("");
    setResult("");
    setBusy(key);
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const data = await response.json();
    setBusy(null);
    if (!response.ok) {
      setError(data.error || "Unable to update this user.");
      return false;
    }
    if (data.login_shop_id) {
      setResult(`${data.shop_name || "Shop"} created. Shop ID: ${data.login_shop_id}`);
    } else if (action === "delete") {
      setResult("User deleted.");
    }
    setAssigning(null);
    router.refresh();
    return true;
  }

  return (
    <div className="grid gap-4">
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={managerOnly ? "Search name or username" : "Search name, email or username"}
        className="max-w-md rounded-xl border px-3 py-2"
      />
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {result ? <p className="text-sm text-[#0B6E4F]">{result}</p> : null}
      <div className="app-table-wrap">
        <table className="app-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Admin</th>
              <th>Assign shop</th>
              {viewerCanDelete ? <th>Delete</th> : null}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const self = user.id === currentUserId;
              const platformOwner = isPlatformOwnerEmail(user.email);
              const locked = self || platformOwner;
              const viewerCanAssignSuper = canAssignSuperAdmin(viewer);
              const userAdminRole = normalizeAdminRole(user.admin_role);
              const owned = shopsByOwner.get(user.id);
              return (
                <tr key={user.id}>
                  <td>
                    <p className="font-medium">{user.name || user.username || "Unnamed"}</p>
                    {user.email ? <p className="text-xs text-[#6B7280]">{user.email}</p> : null}
                    <p className="text-xs text-[#6B7280]">{user.username}</p>
                    {platformOwner ? (
                      <p className="mt-1 text-xs font-semibold text-[#0B6E4F]">Platform admin only</p>
                    ) : null}
                    {owned ? (
                      <p className="mt-1 font-mono text-xs text-[#0B6E4F]">
                        {owned.name} · {owned.login_shop_id} · {owned.provider_type || "both"}
                      </p>
                    ) : null}
                  </td>
                  <td>
                    {managerOnly ? (
                      <p className="text-sm">{user.role.replace("_", " ")}</p>
                    ) : (
                    <select
                      value={platformOwner ? "admin" : user.role}
                      disabled={locked}
                      className="rounded-lg border px-2 py-1 text-sm disabled:opacity-50"
                      onChange={(event) => {
                        const role = event.target.value;
                        if (role === "shop_owner") {
                          setAssigning(user.id);
                          return;
                        }
                        if (role === "customer" && user.role === "shop_owner") {
                          setPendingRevert(user);
                          return;
                        }
                        call("set_role", { userId: user.id, role, adminRole: user.admin_role }, user.id);
                      }}
                    >
                      <option value="customer">customer</option>
                      <option value="shop_owner">shop owner</option>
                      <option value="admin">admin</option>
                    </select>
                    )}
                  </td>
                  <td>
                    {user.role === "admin" || platformOwner ? (
                      platformOwner || managerOnly || (userAdminRole === "super_admin" && !viewerCanAssignSuper) ? (
                        <p className="text-sm font-medium text-[#0B6E4F]">
                          {platformOwner ? "Super admin" : adminRoleLabel(userAdminRole)}
                        </p>
                      ) : (
                      <select
                        value={userAdminRole}
                        disabled={locked}
                        className="rounded-lg border px-2 py-1 text-sm disabled:opacity-50"
                        onChange={(event) =>
                          call("set_role", { userId: user.id, role: "admin", adminRole: event.target.value }, `${user.id}-admin`)
                        }
                      >
                        {viewerCanAssignSuper ? <option value="super_admin">Super admin</option> : null}
                        <option value="admin">Admin</option>
                        <option value="manager">Manager</option>
                      </select>
                      )
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {platformOwner ? (
                      <p className="text-sm text-[#6B7280]">This account stays admin. It cannot be staff or a shop.</p>
                    ) : (
                    <div className="flex flex-col gap-2">
                      {assigning === user.id ? (
                        <form
                          className="grid gap-2 rounded-xl border border-[#E5E7EB] p-2"
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            call(
                              "promote_shop_owner",
                              {
                                userId: user.id,
                                shopName: form.get("shopName"),
                                providerType: form.get("providerType"),
                                category: form.get("category"),
                              },
                              `${user.id}-promote`,
                            );
                          }}
                        >
                          <p className="text-xs font-semibold text-[#0B6E4F]">Create shop for this user</p>
                          <input
                            name="shopName"
                            required
                            defaultValue={owned?.name || user.name || ""}
                            placeholder="Shop name"
                            className="rounded-lg border px-2 py-1 text-sm"
                          />
                          <select name="providerType" defaultValue={owned?.provider_type || "both"} className="rounded-lg border px-2 py-1 text-sm">
                            {SHOP_PROVIDER_TYPES.map((type) => (
                              <option key={type.value} value={type.value}>
                                {type.label}
                              </option>
                            ))}
                          </select>
                          <CategorySelect name="category" defaultValue="other" className="rounded-lg border px-2 py-1 text-sm" />
                          <div className="flex gap-2">
                            <button
                              disabled={self || busy === `${user.id}-promote`}
                              className="rounded-lg bg-[#0B6E4F] px-2 py-1 text-sm text-white disabled:opacity-50"
                            >
                              Assign as shop
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border px-2 py-1 text-sm"
                              onClick={() => setAssigning(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button
                          type="button"
                          className="rounded-lg border px-2 py-1 text-left text-sm"
                          onClick={() => setAssigning(user.id)}
                        >
                          {user.role === "shop_owner" ? "Change shop type" : "Assign as shop"}
                        </button>
                      )}
                      {managerOnly ? null : (
                      <label className="text-xs text-[#6B7280]">
                        Assign as staff
                        <select
                          defaultValue=""
                          className="mt-1 w-full rounded-lg border px-2 py-1 text-sm"
                          onChange={(event) => {
                            if (!event.target.value) return;
                            call("assign_staff", { userId: user.id, shopId: event.target.value, roleName: "staff" }, `${user.id}-staff`);
                          }}
                        >
                          <option value="">Choose shop…</option>
                          {shops.map((shop) => (
                            <option key={shop.id} value={shop.id}>
                              {shop.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      )}
                    </div>
                    )}
                  </td>
                  {viewerCanDelete ? (
                    <td>
                      {self || platformOwner ? (
                        <p className="text-xs text-[#6B7280]">{self ? "This is you" : "Protected"}</p>
                      ) : (
                        <button
                          type="button"
                          disabled={busy === `${user.id}-delete`}
                          className="rounded-lg border border-[#C2413B]/30 px-2 py-1 text-sm font-semibold text-[#C2413B] disabled:opacity-50"
                          onClick={() => setPendingDelete(user)}
                        >
                          Delete
                        </button>
                      )}
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ConfirmDialog
        open={Boolean(pendingRevert)}
        title="Revert this shop to a customer?"
        body={
          pendingRevert
            ? `${shopsByOwner.get(pendingRevert.id)?.name || pendingRevert.name || "This shop"} will be removed from the public shops list, and this user will become a customer.`
            : ""
        }
        confirmLabel="Revert to customer"
        onCancel={() => setPendingRevert(null)}
        onConfirm={() => {
          const user = pendingRevert;
          setPendingRevert(null);
          if (user) void call("set_role", { userId: user.id, role: "customer", adminRole: null }, user.id);
        }}
      />
      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title="Delete this user?"
        body={
          pendingDelete
            ? `${pendingDelete.name || pendingDelete.email || "This user"} will be permanently removed. If they own a shop, that shop is deleted too. This cannot be undone.`
            : ""
        }
        confirmLabel="Delete user"
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          const user = pendingDelete;
          setPendingDelete(null);
          if (user) void call("delete", { userId: user.id }, `${user.id}-delete`);
        }}
      />
    </div>
  );
}
