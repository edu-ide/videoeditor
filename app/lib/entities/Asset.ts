import { Entity, PrimaryColumn, Column, CreateDateColumn, DeleteDateColumn } from "typeorm";

@Entity("assets")
export class Asset {
    @PrimaryColumn({ type: "varchar" })
    id!: string;

    @Column({ type: "varchar" })
    user_id!: string;

    @Column({ nullable: true, type: "varchar" })
    project_id!: string | null;

    @Column({ type: "varchar" })
    original_name!: string;

    @Column({ type: "varchar" })
    storage_key!: string;

    @Column({ type: "varchar" })
    mime_type!: string;

    @Column({ type: "int" })
    size_bytes!: number;

    @Column({ nullable: true, type: "int" })
    width!: number | null;

    @Column({ nullable: true, type: "int" })
    height!: number | null;

    @Column({ nullable: true, type: "float" })
    duration_seconds!: number | null;

    @CreateDateColumn()
    created_at!: Date;

    @DeleteDateColumn()
    deleted_at!: Date | null;
}
