import React from 'react';
import { Button, Tooltip } from 'antd';
import { useUserRole } from '../hooks/useUserRole';

/**
 * Button component that's only enabled for admin users
 * Regular users see it disabled with a tooltip
 */
const OnlineActionButton = ({ children, onClick, ...props }) => {
  const { isLoaded, canPerformOnlineActions, isAdmin } = useUserRole();

  if (!isLoaded) {
    return <Button {...props} loading>Loading...</Button>;
  }

  if (!canPerformOnlineActions) {
    return (
      <Tooltip title="Administrator privileges required for online actions. Please contact your system administrator.">
        <Button {...props} disabled>
          {children} (Admin Only)
        </Button>
      </Tooltip>
    );
  }

  return (
    <Button {...props} onClick={onClick}>
      {children}
    </Button>
  );
};

export default OnlineActionButton;
