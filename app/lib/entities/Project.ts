import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity("projects")
export class Project {
    @PrimaryColumn({ type: "varchar" })
    id!: string;

    @Column({ type: "varchar" })
    user_id!: string;

    @Column({ type: "varchar" })
    name!: string;

    @CreateDateColumn()
    created_at!: Date;

    @UpdateDateColumn()
    updated_at!: Date;

    @Column("simple-json", { nullable: true })
    timeline?: any;

    @Column("simple-json", { nullable: true })
    textBinItems?: any;
}
