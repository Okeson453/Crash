import { useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { getAdminUsers } from '@/api/admin';
import { UserSearchBar } from '@/components/admin/UserSearchBar';
import { UserFilterChips } from '@/components/admin/UserFilterChips';
import { UserListItem } from '@/components/admin/UserListItem';
import { UserDetailSheet } from '@/components/admin/UserDetailSheet';
import { LoadingSpinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Button } from '@/components/ui/Button';
import { Users } from 'lucide-react';
import type { User } from '@/types/api';

type UserStatusFilter = 'all' | 'active' | 'suspended' | 'banned' | 'onboarding';

export function AdminUsersScreen() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<UserStatusFilter>('all');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const query = useInfiniteQuery({
    queryKey: ['admin-users', search, filter],
    queryFn: ({ pageParam }) =>
      getAdminUsers({
        cursor: pageParam,
        search: search || undefined,
        status: filter === 'all' ? undefined : filter,
      }),
    getNextPageParam: (lastPage) => lastPage.pagination.cursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const users = query.data?.pages.flatMap((p) => p.data) ?? [];

  if (query.isLoading) return <LoadingSpinner size="lg" />;

  if (!users.length) {
    return (
      <div className="space-y-4">
        <UserSearchBar value={search} onChange={setSearch} />
        <UserFilterChips value={filter} onChange={setFilter} />
        <EmptyState
          icon={Users}
          title="No users found"
          description={search ? 'Try a different search term.' : 'No users match the selected filter.'}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <UserSearchBar value={search} onChange={setSearch} />
      <UserFilterChips value={filter} onChange={setFilter} />
      <div className="space-y-2">
        {users.map((user) => (
          <UserListItem key={user.id} user={user} onClick={() => setSelectedUser(user)} />
        ))}
      </div>
      {query.hasNextPage && (
        <Button
          className="w-full"
          loading={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Load more
        </Button>
      )}
      <UserDetailSheet user={selectedUser} onClose={() => setSelectedUser(null)} />
    </div>
  );
}
