BEGIN TRY

BEGIN TRAN;

-- CreateTable
CREATE TABLE [dbo].[Users] (
    [id] INT NOT NULL IDENTITY(1,1),
    [name] VARCHAR(100) NOT NULL,
    [id_number] VARCHAR(50) NOT NULL,
    [role] VARCHAR(20) NOT NULL,
    [phone_number] VARCHAR(20) NOT NULL,
    [gender] VARCHAR(10) NOT NULL,
    [is_active] BIT NOT NULL CONSTRAINT [Users_is_active_df] DEFAULT 1,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [Users_created_at_df] DEFAULT CURRENT_TIMESTAMP,
    [updated_at] DATETIME2 NOT NULL,
    [created_by] VARCHAR(100) NOT NULL,
    CONSTRAINT [Users_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Users_id_number_key] UNIQUE NONCLUSTERED ([id_number])
);

-- CreateTable
CREATE TABLE [dbo].[Employees] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employee_id] INT NOT NULL,
    [name] VARCHAR(100) NOT NULL,
    [id_number] VARCHAR(50) NOT NULL,
    [role] VARCHAR(20) NOT NULL,
    [email] VARCHAR(100) NOT NULL,
    [password] VARCHAR(255) NOT NULL,
    [date_of_birth] DATE NOT NULL,
    [id_card_path] VARCHAR(255) NOT NULL,
    [passport_photo] VARCHAR(255) NOT NULL,
    [created_at] DATETIME2 NOT NULL CONSTRAINT [DF_Employeescreat_3A81B327] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [Employees_pkey] PRIMARY KEY CLUSTERED ([id]),
    CONSTRAINT [Employees_employee_id_key] UNIQUE NONCLUSTERED ([employee_id]),
    CONSTRAINT [UQ_Employee_AB6E61647DECD8E0] UNIQUE NONCLUSTERED ([email])
);

-- CreateTable
CREATE TABLE [dbo].[Attendance] (
    [id] INT NOT NULL IDENTITY(1,1),
    [employee_id] INT NOT NULL,
    [date] DATE NOT NULL,
    [check_in_time] DATETIME2,
    [check_out_time] DATETIME2,
    [status] VARCHAR(10) NOT NULL CONSTRAINT [DF_Attendancstatu_403A8C7D] DEFAULT 'Absent',
    CONSTRAINT [PK_Attendan_3213E83FBD2CD3D1] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Users_id_number_idx] ON [dbo].[Users]([id_number]);

-- CreateIndex
CREATE NONCLUSTERED INDEX [Employees_id_number_role_idx] ON [dbo].[Employees]([id_number], [role]);

-- AddForeignKey
ALTER TABLE [dbo].[Employees] ADD CONSTRAINT [Employees_employee_id_fkey] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[Users]([id]) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE [dbo].[Attendance] ADD CONSTRAINT [FK_Attendancemplo_412EB0B6] FOREIGN KEY ([employee_id]) REFERENCES [dbo].[Employees]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
