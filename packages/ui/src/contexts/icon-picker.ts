import { createContext, useContext } from 'react';

import { Icon } from '@worknest/client/types';

interface IconPickerContextProps {
  onPick: (icon: Icon) => void;
}

export const IconPickerContext = createContext<IconPickerContextProps>(
  {} as IconPickerContextProps
);

export const useIconPicker = () => useContext(IconPickerContext);
