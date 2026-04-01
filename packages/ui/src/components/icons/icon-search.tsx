import { IconPickerItem } from '@worknest/ui/components/icons/icon-picker-item';
import {
  ScrollArea,
  ScrollViewport,
  ScrollBar,
} from '@worknest/ui/components/ui/scroll-area';
import { useQuery } from '@worknest/ui/hooks/use-query';

interface IconSearchProps {
  query: string;
}

export const IconSearch = ({ query }: IconSearchProps) => {
  const iconSearchQuery = useQuery({
    type: 'icon.search',
    query,
    count: 100,
  });

  const icons = iconSearchQuery.data ?? [];

  return (
    <ScrollArea className="h-full overflow-auto">
      <ScrollViewport>
        <div className="grid w-full min-w-full grid-cols-10 gap-1">
          <div className="col-span-full flex items-center py-1 pl-1 text-sm text-muted-foreground">
            <p>Search results for &quot;{query}&quot;</p>
          </div>
          {icons.map((icon) => (
            <IconPickerItem key={icon.id} icon={icon} />
          ))}
        </div>
      </ScrollViewport>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  );
};
