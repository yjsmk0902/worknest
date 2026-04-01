import { getIdType, IdType } from '@worknest/core';
import { AvatarFallback } from '@worknest/ui/components/avatars/avatar-fallback';
import { AvatarImage } from '@worknest/ui/components/avatars/avatar-image';
import { EmojiElement } from '@worknest/ui/components/emojis/emoji-element';
import { IconElement } from '@worknest/ui/components/icons/icon-element';
import {
  AvatarProps,
  getAvatarSizeClasses,
  getDefaultNodeAvatar,
} from '@worknest/ui/lib/avatars';
import { cn } from '@worknest/ui/lib/utils';

export const Avatar = (props: AvatarProps) => {
  let avatar = props.avatar;

  if (!avatar || avatar === '') {
    const idType = getIdType(props.id);
    const defaultAvatar = getDefaultNodeAvatar(idType);
    avatar = defaultAvatar;
  }

  if (!avatar) {
    return <AvatarFallback {...props} />;
  }

  const avatarType = getIdType(avatar);
  if (avatarType === IdType.EmojiSkin) {
    return (
      <EmojiElement
        id={avatar}
        className={cn(getAvatarSizeClasses(props.size), props.className)}
      />
    );
  }

  if (avatarType === IdType.Icon) {
    return (
      <IconElement
        id={avatar}
        className={cn(getAvatarSizeClasses(props.size), props.className)}
      />
    );
  }

  if (avatarType === IdType.Avatar) {
    return <AvatarImage {...props} />;
  }

  return <AvatarFallback {...props} />;
};
