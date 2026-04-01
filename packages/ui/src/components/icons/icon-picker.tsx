import { useState } from 'react';

import { Icon } from '@worknest/client/types';
import { IconBrowser } from '@worknest/ui/components/icons/icon-browser';
import { IconSearch } from '@worknest/ui/components/icons/icon-search';
import { Input } from '@worknest/ui/components/ui/input';
import { IconPickerContext } from '@worknest/ui/contexts/icon-picker';

interface IconPickerProps {
  onPick: (icon: Icon) => void;
}

export const IconPicker = ({ onPick }: IconPickerProps) => {
  const [query, setQuery] = useState('');

  return (
    <IconPickerContext.Provider value={{ onPick }}>
      <div className="flex flex-col gap-1 p-1">
        <Input
          type="text"
          placeholder="Search icons..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="h-[280px] min-h-[280px] w-[330px] min-w-[330px]">
          {query.length > 2 ? <IconSearch query={query} /> : <IconBrowser />}
        </div>
      </div>
    </IconPickerContext.Provider>
  );
};
