import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  enableScrollUpdate?: boolean;
  outerClassName?: string;
  pre?: React.ReactNode;
  suffix?: React.ReactNode;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      enableScrollUpdate,
      outerClassName,
      type,
      pre,
      suffix,
      ...props
    },
    ref
  ) => {
    return (
      <div
        className={cn('relative flex size-full items-center', outerClassName)}
      >
        {pre && (
          <div className="absolute inset-y-0 left-0 ml-2 flex w-6 items-center">
            {pre}
          </div>
        )}
        <input
          maxLength={255}
          type={type}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
            className,
            {
              'pl-8': !!pre,
              'pr-10': type === 'number' && !!suffix,
            }
          )}
          ref={ref}
          onWheel={
            enableScrollUpdate === true
              ? undefined
              : (e) => {
                  (e.target as HTMLInputElement).blur();
                }
          }
          {...props}
        />
        {suffix && (
          <div className="absolute inset-y-0 right-2 flex items-center">
            {suffix}
          </div>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };
