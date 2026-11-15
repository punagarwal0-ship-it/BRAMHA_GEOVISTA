`timescale 1ns/1ps
module sar_speckle_filter_tb;
    reg clk = 0;
    always #5 clk = ~clk;
    reg rst, valid_in;
    reg [7:0] p0,p1,p2,p3,p4,p5,p6,p7,p8;
    wire [7:0] pixel_out;
    wire valid_out;
    integer errors;

    sar_speckle_filter dut(clk,rst,p0,p1,p2,p3,p4,p5,p6,p7,p8,
                           valid_in,pixel_out,valid_out);

    task check;
        input [7:0] expected;
        begin
            @(posedge clk); #1;
            if (valid_out !== 1'b1 || pixel_out !== expected) begin
                $display("FAIL expected=%0d got=%0d valid=%b", expected,pixel_out,valid_out);
                errors = errors + 1;
            end
        end
    endtask

    initial begin
        errors=0; rst=1; valid_in=0;
        p0=0;p1=0;p2=0;p3=0;p4=0;p5=0;p6=0;p7=0;p8=0;
        repeat(2) @(posedge clk);
        @(negedge clk); rst=0;
        // Ordered values: median 5.
        p0=1;p1=2;p2=3;p3=4;p4=5;p5=6;p6=7;p7=8;p8=9; valid_in=1;
        check(5);
        // Isolated high impulse in a zero neighbourhood: median 0.
        @(negedge clk); p0=0;p1=0;p2=0;p3=0;p4=255;p5=0;p6=0;p7=0;p8=0;
        check(0);
        // Boundary values and duplicates: median 255.
        @(negedge clk); p0=255;p1=255;p2=255;p3=255;p4=0;p5=255;p6=255;p7=255;p8=255;
        check(255);
        // Uniform images exercise the equal-value tie handling.
        @(negedge clk); p0=0;p1=0;p2=0;p3=0;p4=0;p5=0;p6=0;p7=0;p8=0;
        check(0);
        @(negedge clk); p0=123;p1=123;p2=123;p3=123;p4=123;p5=123;p6=123;p7=123;p8=123;
        check(123);
        // Invalid cycle must suppress valid_out and preserve data.
        @(negedge clk); valid_in=0; p0=0;p1=1;p2=2;p3=3;p4=4;p5=5;p6=6;p7=7;p8=8;
        @(posedge clk); #1;
        if (valid_out !== 1'b0) begin $display("FAIL invalid cycle asserted valid_out"); errors=errors+1; end
        if (errors==0) $display("PASS: sar_speckle_filter_tb");
        else $display("FAIL: %0d error(s)",errors);
        $finish;
    end
endmodule
