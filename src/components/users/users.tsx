// components/users/users.tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Edit, Eye } from "lucide-react";
import { User } from "@/lib/types/user";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import Image from "next/image";

interface UsersTableProps {
  users: User[];
  onEdit: (user: User) => void;
}

export default function UsersTable({ users, onEdit }: UsersTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Profile</TableHead>
          <TableHead>Name</TableHead>
          <TableHead>ID/Passport Number</TableHead>
          <TableHead>Role</TableHead>
          <TableHead>Department</TableHead>
          <TableHead>Phone Number</TableHead>
          <TableHead>Gender</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Documents</TableHead>
          <TableHead>Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow key={user.id}>
            <TableCell>
              <Avatar className="h-10 w-10">
                {user.passport_photo ? (
                  <AvatarImage src={user.passport_photo} alt={user.name} />
                ) : (
                  <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                )}
              </Avatar>
            </TableCell>
            <TableCell>{user.name}</TableCell>
            <TableCell>{user.id_number}</TableCell>
            <TableCell className="capitalize">{user.role}</TableCell>
              <TableCell className="capitalize">{user.department}</TableCell>
            <TableCell>{user.phone_number}</TableCell>
            <TableCell className="capitalize">{user.gender}</TableCell>
            <TableCell>
              <span className={`px-2 py-1 rounded-full text-sm ${
                user.is_active 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {user.is_active ? 'Active' : 'Inactive'}
              </span>
            </TableCell>
            <TableCell>
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Eye className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{user.name}&apos;s Documents</DialogTitle>
                  </DialogHeader>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <h3 className="font-medium">Passport Photo</h3>
                      {user.passport_photo ? (
                        <div className="relative aspect-square w-full max-w-[200px] overflow-hidden rounded-lg border">
                          <Image
                            src={user.passport_photo}
                            alt="Passport Photo"
                            layout="fill"
                            objectFit="cover"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No passport photo available</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <h3 className="font-medium">ID Card/Passport</h3>
                      {user.id_card_path ? (
                        <div className="relative aspect-[3/2] w-full max-w-[300px] overflow-hidden rounded-lg border">
                          <Image
                            src={user.id_card_path}
                            alt="ID Card"
                            layout="fill"
                            objectFit="cover"
                            className="object-cover"
                          />
                        </div>
                      ) : (
                        <p className="text-sm text-gray-500">No ID card/Passport available</p>
                      )}
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onEdit(user)}
              >
                <Edit className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}