// components/profile/PasswordChangeForm.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordForm } from '@/lib/types/profile';

interface PasswordChangeFormProps {
  onSubmit: (e: React.FormEvent) => Promise<void>;
  onCancel: () => void;
  passwordForm: PasswordForm;
  setPasswordForm: (form: PasswordForm) => void;
  isSubmitting: boolean;
}

export function PasswordChangeForm({
  onSubmit,
  onCancel,
  passwordForm,
  setPasswordForm,
  isSubmitting,
}: PasswordChangeFormProps) {
  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Change Password</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
          {['currentPassword', 'newPassword', 'confirmPassword'].map((field) => (
            <div key={field} className="space-y-2">
              <Label htmlFor={field}>
                {field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1')}
              </Label>
              <Input
                id={field}
                type="password"
                value={passwordForm[field as keyof PasswordForm]}
                onChange={(e) =>
                  setPasswordForm({
                    ...passwordForm,
                    [field]: e.target.value,
                  })
                }
                required
              />
            </div>
          ))}
          <div className="flex justify-end space-x-2">
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Changing...' : 'Change Password'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
