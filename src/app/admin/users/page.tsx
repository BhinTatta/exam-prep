import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { PageHeader } from "@/components/page-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { RoleSelect } from "@/components/admin/role-select";

export const metadata = { title: "Users" };

export default async function AdminUsersPage() {
  const session = await auth();
  const users = await prisma.user.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div>
      <PageHeader title="Users" description="Promote trusted users to moderator, or manage roles." />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Email</TableHead>
            <TableHead className="text-right">Role</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((u) => (
            <TableRow key={u.id}>
              <TableCell className="flex items-center gap-2">
                <Avatar className="size-7">
                  <AvatarImage src={u.image ?? undefined} />
                  <AvatarFallback>{(u.name ?? "U").slice(0, 1)}</AvatarFallback>
                </Avatar>
                {u.name}
              </TableCell>
              <TableCell className="text-muted-foreground">{u.email ?? "—"}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <RoleSelect userId={u.id} role={u.role} disabled={u.id === session?.user?.id} />
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
