"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useFormStatus } from "react-dom";

type ImageFieldRegistration = {
  validate: () => boolean;
  showRequiredError: () => void;
};

type AdminFormActivity = {
  uploadsActive: boolean;
  registerImageField: (
    id: string,
    registration: ImageFieldRegistration,
  ) => () => void;
  setUploadActive: (id: string, active: boolean) => void;
};

const AdminFormActivityContext = createContext<AdminFormActivity | null>(null);

export function useAdminFormActivity() {
  const context = useContext(AdminFormActivityContext);
  if (!context)
    throw new Error("Admin image fields must be rendered inside an AdminForm.");
  return context;
}

export function AdminForm({
  action,
  className,
  children,
}: {
  action: (data: FormData) => Promise<void>;
  className?: string;
  children: ReactNode;
}) {
  const activeUploads = useRef(new Set<string>());
  const imageFields = useRef(new Map<string, ImageFieldRegistration>());
  const [uploadsActive, setUploadsActive] = useState(false);

  const setUploadActive = useCallback((id: string, active: boolean) => {
    if (active) activeUploads.current.add(id);
    else activeUploads.current.delete(id);
    setUploadsActive(activeUploads.current.size > 0);
  }, []);

  const registerImageField = useCallback(
    (id: string, registration: ImageFieldRegistration) => {
      imageFields.current.set(id, registration);
      return () => {
        imageFields.current.delete(id);
        activeUploads.current.delete(id);
        setUploadsActive(activeUploads.current.size > 0);
      };
    },
    [],
  );

  const value = useMemo(
    () => ({ uploadsActive, registerImageField, setUploadActive }),
    [registerImageField, setUploadActive, uploadsActive],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (activeUploads.current.size > 0) {
      event.preventDefault();
      return;
    }
    let valid = true;
    for (const registration of imageFields.current.values()) {
      if (!registration.validate()) {
        registration.showRequiredError();
        valid = false;
      }
    }
    if (!valid) event.preventDefault();
  }

  return (
    <AdminFormActivityContext.Provider value={value}>
      <form action={action} className={className} onSubmit={handleSubmit}>
        {children}
      </form>
    </AdminFormActivityContext.Provider>
  );
}

export function PendingSaveButton({
  saveLabel,
  savingLabel,
  className,
}: {
  saveLabel: string;
  savingLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  const { uploadsActive } = useAdminFormActivity();
  const disabled = pending || uploadsActive;
  return (
    <button
      type="submit"
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
      disabled={disabled}
      aria-disabled={disabled}
    >
      {pending ? (
        <>
          <span
            aria-hidden="true"
            className="mr-[8px] size-[15px] animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none"
          />
          {savingLabel}
        </>
      ) : (
        saveLabel
      )}
    </button>
  );
}
